// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

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
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/session`);
  }

  // 1. Properly pull Next.js 15 async cookies into memory
  const cookieStore = await cookies();
  
  // Force sync reading of headers to make sure Vercel/Next reads the request state completely
  cookieStore.getAll(); 

  // 2. Initialize a standard server client purely to manage token exchange safely
  let supabaseSessionError = false;
  let tokensData: any = null;

  const supabaseExchangeClient = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Inside a route handler, we can write back to cookies using the response instead.
          // We can let the exchange client read them safely here.
        },
      },
    }
  );

  // 3. Exchange code for session using native Supabase SSR methods 
  // This automatically reads the correct verifier cookie key name with zero guessing.
  const { data: exchangeData, error: exchangeError } = 
    await supabaseExchangeClient.auth.exchangeCodeForSession(code);

  if (exchangeError || !exchangeData?.session) {
    console.error('[callback] Token exchange failed via SDK:', exchangeError?.message);
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  const session = exchangeData.session;
  const user = session.user;

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
    access_token: session.access_token,
    refresh_token: session.refresh_token,
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

  // 4. Safely clear out the standard verifier cookie keys using standard SDK logic cleanups
  const projectRef = SUPABASE_URL.split('//')[1].split('.')[0];
  response.cookies.delete(`sb-${projectRef}-auth-token-code-verifier`);

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