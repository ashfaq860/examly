// src/app/auth/callback/route.ts
// The PKCE verifier is stored by Supabase JS in a cookie named:
// sb-<project-ref>-auth-token-code-verifier
// We need to read it here and pass it manually to the token endpoint.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['teacher', 'admin', 'super_admin', 'academy'] as const;
type UserRole = (typeof ALLOWED_ROLES)[number];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get('code');
  const errorParam = requestUrl.searchParams.get('error');

  if (errorParam) {
    console.error('OAuth provider error:', errorParam);
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  if (!code) {
    // No code — redirect to session page (handles implicit/fragment flow)
    return NextResponse.redirect(`${origin}/auth/session`);
  }

  const cookieStore = await cookies();

  // -----------------------------------------------------------------------
  // Find the PKCE code verifier cookie.
  // Supabase JS stores it under one of these names:
  //   sb-<ref>-auth-token-code-verifier   (new format)
  //   pkce-code-verifier                  (legacy)
  // -----------------------------------------------------------------------
  const allCookies = cookieStore.getAll();

  console.log('[callback] All cookies:', allCookies.map(c => c.name).join(', '));

  const verifierCookie = allCookies.find(
    c => c.name.includes('code-verifier') || c.name.includes('pkce')
  );

  const codeVerifier = verifierCookie?.value;

  console.log('[callback] code:', code?.slice(0, 8), '... verifier found:', !!codeVerifier);
  console.log('[callback] verifier cookie name:', verifierCookie?.name);

  // -----------------------------------------------------------------------
  // Exchange the code for tokens using the REST API directly.
  // This lets us pass the code_verifier explicitly.
  // -----------------------------------------------------------------------
  const tokenEndpoint = `${SUPABASE_URL}/auth/v1/token?grant_type=pkce`;

  const body: Record<string, string> = { auth_code: code };
  if (codeVerifier) body.code_verifier = codeVerifier;

  const tokenRes = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!tokenRes.ok) {
    const tokenErr = await tokenRes.text();
    console.error('[callback] Token exchange failed:', tokenErr);
    // Redirect to session page — let the client try to recover
    return NextResponse.redirect(`${origin}/auth/session`);
  }

  const tokens = await tokenRes.json();
  const user = tokens.user;

  if (!user?.id) {
    console.error('[callback] No user in token response');
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  // Ensure profile exists
  await ensureProfile(user);

  const role = await getRole(user.id);
  if (!role || !ALLOWED_ROLES.includes(role as UserRole)) {
    return NextResponse.redirect(`${origin}/auth/login?error=unauthorized_role`);
  }

  const redirectPath = role === 'admin' || role === 'super_admin' ? '/admin' : '/dashboard';
  const response = NextResponse.redirect(`${origin}${redirectPath}`);

  // Set the access token and refresh token as cookies so the client is authenticated
  const maxAge = tokens.expires_in ?? 3600;

  // Supabase session cookie (read by createBrowserClient)
  const projectRef = SUPABASE_URL.split('//')[1].split('.')[0];
  const sessionData = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + maxAge,
    expires_in: maxAge,
    token_type: 'bearer',
    user,
  };

  response.cookies.set(`sb-${projectRef}-auth-token`, JSON.stringify(sessionData), {
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  // Role cookie — JS readable
  response.cookies.set('role', role, {
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  // Clear the verifier cookie — it's been used
  if (verifierCookie) {
    response.cookies.delete(verifierCookie.name);
  }

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
      full_name: user.user_metadata?.name || user.user_metadata?.full_name ||
        user.email?.split('@')[0] || 'User',
      role: 'teacher',
      login_method: 'google',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
}