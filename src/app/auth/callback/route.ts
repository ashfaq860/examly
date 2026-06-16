// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['teacher', 'admin', 'super_admin', 'academy'] as const;
type UserRole = (typeof ALLOWED_ROLES)[number];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const PROJECT_REF = SUPABASE_URL.split('//')[1].split('.')[0];
const VERIFIER_COOKIE = `sb-${PROJECT_REF}-auth-token-code-verifier`;

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get('code');
  const errorParam = requestUrl.searchParams.get('error');

  if (errorParam) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/session`);
  }

  const cookieStore = await cookies();
  const codeVerifier = cookieStore.get(VERIFIER_COOKIE)?.value;

  if (!codeVerifier) {
    console.error('[callback] Verifier cookie missing');
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  // Exchange code + verifier for tokens
  const tokenRes = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=pkce`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        auth_code: code,
        code_verifier: codeVerifier,
      }),
    }
  );

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error('[callback] Token exchange failed:', err);
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  const tokens = await tokenRes.json();
  const user = tokens.user;

  if (!user?.id) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  await ensureProfile(user);

  const role = await getRole(user.id);
  if (!role || !ALLOWED_ROLES.includes(role as UserRole)) {
    return NextResponse.redirect(`${origin}/auth/login?error=unauthorized_role`);
  }

  // -----------------------------------------------------------------------
  // Pass tokens to /auth/session via a short-lived server-set cookie.
  // The session page calls supabase.auth.setSession() with these tokens
  // so Supabase JS writes them in its own chunked format correctly.
  // -----------------------------------------------------------------------
  const tempSession = JSON.stringify({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    role,
  });

  const redirectPath = role === 'admin' || role === 'super_admin' ? '/admin' : '/dashboard';
  const response = NextResponse.redirect(`${origin}/auth/session?to=${encodeURIComponent(redirectPath)}`);

  // Short-lived temp cookie — only needed for the /auth/session page
  response.cookies.set('sb-temp-session', tempSession, {
    path: '/',
    maxAge: 60, // 60 seconds — single use
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  // Role cookie
  response.cookies.set('role', role, {
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  // Clear used verifier
  response.cookies.delete(VERIFIER_COOKIE);

  return response;
}

async function getRole(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('profiles').select('role').eq('id', userId).maybeSingle();
  return data?.role ?? null;
}

async function ensureProfile(user: any) {
  const { data: existing } = await supabaseAdmin
    .from('profiles').select('id').eq('id', user.id).maybeSingle();

  if (!existing) {
    await supabaseAdmin.from('profiles').insert({
      id: user.id,
      email: user.email,
      full_name:
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        'User',
      role: 'teacher',
      login_method: 'google',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
}