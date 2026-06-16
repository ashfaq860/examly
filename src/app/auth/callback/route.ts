// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['teacher', 'admin', 'super_admin', 'academy'] as const;
type UserRole = (typeof ALLOWED_ROLES)[number];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Derived from SUPABASE_URL: https://gdrinwaykoscxkvjjtla.supabase.co
const PROJECT_REF = SUPABASE_URL.split('//')[1].split('.')[0];
// Cookie name Supabase JS uses for the PKCE verifier
const VERIFIER_COOKIE = `sb-${PROJECT_REF}-auth-token-code-verifier`;

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get('code');
  const errorParam = requestUrl.searchParams.get('error');

  if (errorParam) {
    console.error('[callback] OAuth provider error:', errorParam);
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/session`);
  }

  const cookieStore = await cookies();

  // Read the PKCE verifier using the exact cookie name
  const codeVerifier = cookieStore.get(VERIFIER_COOKIE)?.value;

  console.log('[callback] project ref:', PROJECT_REF);
  console.log('[callback] verifier cookie name:', VERIFIER_COOKIE);
  console.log('[callback] verifier value found:', !!codeVerifier);
  console.log('[callback] verifier length:', codeVerifier?.length);

  if (!codeVerifier) {
    console.error('[callback] PKCE verifier cookie missing. Available cookies:',
      cookieStore.getAll().map(c => c.name).join(', '));
    return NextResponse.redirect(`${origin}/auth/session`);
  }

  // Exchange code + verifier directly via REST API
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
    console.error('[callback] No user in token response');
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  console.log('[callback] Token exchange success for user:', user.id);

  await ensureProfile(user);

  const role = await getRole(user.id);
  if (!role || !ALLOWED_ROLES.includes(role as UserRole)) {
    console.error('[callback] Unauthorized role:', role);
    return NextResponse.redirect(`${origin}/auth/login?error=unauthorized_role`);
  }

  const redirectPath = role === 'admin' || role === 'super_admin' ? '/admin' : '/dashboard';
  const response = NextResponse.redirect(`${origin}${redirectPath}`);

  // Write the full session into the Supabase auth cookie so the browser
  // client picks it up immediately without needing another round-trip
  const sessionData = JSON.stringify({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in ?? 3600),
    expires_in: tokens.expires_in ?? 3600,
    token_type: 'bearer',
    user,
  });

  // Supabase chunks large cookies — write the session as a single cookie
  // (it will be chunked automatically by the browser if needed)
  response.cookies.set(`sb-${PROJECT_REF}-auth-token`, sessionData, {
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  // Role cookie — JS-readable for middleware
  response.cookies.set('role', role, {
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  // Clear the used verifier cookie
  response.cookies.delete(VERIFIER_COOKIE);

  return response;
}

async function getRole(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  return data?.role ?? null;
}

async function ensureProfile(user: any) {
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabaseAdmin.from('profiles').insert({
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
    if (error) console.error('[callback] Profile insert error:', error);
  }
}