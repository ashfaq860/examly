// src/app/auth/callback/route.ts
// With implicit flow, Supabase sends the access_token in the URL *fragment* (#),
// which servers cannot read. So this route only needs to handle the rare case
// where a code param appears (e.g. email magic links), and redirect everything
// else to /auth/session where the client reads the fragment.
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['teacher', 'admin', 'super_admin', 'academy'] as const;
type UserRole = (typeof ALLOWED_ROLES)[number];

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get('code');
  const errorParam = requestUrl.searchParams.get('error');

  if (errorParam) {
    console.error('OAuth provider error:', errorParam);
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  // -----------------------------------------------------------------------
  // Implicit flow: token arrives in the URL fragment (#access_token=...).
  // Fragments are never sent to the server, so redirect to the client-side
  // /auth/session page which reads the fragment and establishes the session.
  // -----------------------------------------------------------------------
  if (!code) {
    return NextResponse.redirect(`${origin}/auth/session`);
  }

  // -----------------------------------------------------------------------
  // Code flow (magic links, email OTP): exchange the code for a session.
  // -----------------------------------------------------------------------
  const cookieStore = await cookies();
  const response = NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, options); } catch {}
            response.cookies.set(name, value, {
              ...options,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
            });
          });
        },
      },
    }
  );

  const { data: { session }, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !session) {
    console.error('Code exchange error:', exchangeError?.message);
    // Fall through to session page — client may still recover
    return NextResponse.redirect(`${origin}/auth/session`);
  }

  await ensureProfile(session.user);

  const role = await getRole(session.user.id);
  if (!role || !ALLOWED_ROLES.includes(role as UserRole)) {
    return NextResponse.redirect(`${origin}/auth/login?error=unauthorized_role`);
  }

  const finalResponse = NextResponse.redirect(
    `${origin}${role === 'admin' || role === 'super_admin' ? '/admin' : '/dashboard'}`
  );

  // Copy session cookies onto final response
  response.cookies.getAll().forEach(({ name, value }) => {
    finalResponse.cookies.set(name, value, {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: name.startsWith('sb-'),
    });
  });

  finalResponse.cookies.set('role', role, {
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return finalResponse;
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