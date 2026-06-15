// src/app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_ROLES = ['teacher', 'admin', 'super_admin', 'academy'] as const;
type UserRole = (typeof ALLOWED_ROLES)[number];

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  const cookieStore = await cookies();

  // DEBUG — temporary, remove after confirming fix
  const allCookies = cookieStore.getAll();
  console.log(
    '[callback] cookies present:',
    allCookies.map((c) => c.name)
  );
  const hasVerifier = allCookies.some((c) =>
    c.name.includes('code-verifier')
  );
  console.log('[callback] PKCE verifier cookie present:', hasVerifier);

  // ✅ Single supabase client — reads AND writes only via cookieStore.
  // Do NOT create a response before the exchange. The session cookies
  // written by exchangeCodeForSession go into cookieStore, which we
  // then copy onto the final response below.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Write session cookies into the cookieStore only.
          // We copy them onto the response manually after building it.
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { session },
    error: exchangeError,
  } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !session) {
    console.error('[callback] Session exchange error:', exchangeError?.message);
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  try {
    const { data: existingProfile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('[callback] Profile fetch error:', fetchError);
      return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
    }

    let role: string = 'teacher';

    if (!existingProfile) {
      const { error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: session.user.id,
          email: session.user.email,
          full_name:
            session.user.user_metadata?.name ||
            session.user.user_metadata?.full_name ||
            session.user.email?.split('@')[0] ||
            'User',
          role: 'teacher',
          login_method: 'google',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('[callback] Profile insert error:', insertError);
        return NextResponse.redirect(
          `${origin}/auth/login?error=profile_creation_failed`
        );
      }
    } else {
      role = existingProfile.role ?? 'teacher';
    }

    if (!ALLOWED_ROLES.includes(role as UserRole)) {
      console.error('[callback] Unauthorized role:', role);
      await supabase.auth.signOut();
      return NextResponse.redirect(
        `${origin}/auth/login?error=unauthorized_role`
      );
    }

    const redirectPath =
      role === 'admin' || role === 'super_admin' ? '/admin' : '/dashboard';

    // ✅ Build the ONE final response here — after the exchange succeeds.
    const response = NextResponse.redirect(`${origin}${redirectPath}`);

    // ✅ Copy ALL cookies that were written into cookieStore during
    // exchangeCodeForSession onto the outgoing response so the browser
    // receives the session tokens (sb-*-auth-token cookies).
    cookieStore.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, {
        path: '/',
        // Preserve httpOnly/secure/sameSite for auth token cookies
        httpOnly: cookie.name.startsWith('sb-'),
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
    });

    // Role cookie — JS-readable for client-side role checks
    response.cookies.set('role', role, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (error) {
    console.error('[callback] Unexpected error:', error);
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }
}