// src/app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['teacher', 'admin', 'super_admin', 'academy'] as const;
type UserRole = (typeof ALLOWED_ROLES)[number];

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get('code');
  const supabaseResponse = NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  const cookieStore = await cookies();

  // Build the final redirect response FIRST so we can write cookies onto it
  // inside setAll — this is the key fix for PKCE verifier not reaching browser
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // ✅ Write cookies onto BOTH cookieStore AND the response object.
        // Without writing to the response, the browser never receives
        // the session cookies after the redirect and the PKCE verifier
        // written by createBrowserClient is never readable server-side.
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            supabaseResponse.cookies.set(name, value, options);
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
    console.error('Session exchange error:', exchangeError?.message);
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  try {
    const { data: existingProfile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Profile fetch error:', fetchError);
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
        console.error('Profile insert error:', insertError);
        return NextResponse.redirect(`${origin}/auth/login?error=profile_creation_failed`);
      }
    } else {
      role = existingProfile.role ?? 'teacher';
    }

    if (!ALLOWED_ROLES.includes(role as UserRole)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/auth/login?error=unauthorized_role`);
    }

    const redirectPath = role === 'admin' || role === 'super_admin' ? '/admin' : '/dashboard';

    // Update the response to redirect to the correct destination
    const finalResponse = NextResponse.redirect(`${origin}${redirectPath}`);

    supabaseResponse.cookies.getAll().forEach((cookie) => {
      finalResponse.cookies.set(cookie);
    });

    // Role cookie — JS-readable
    finalResponse.cookies.set('role', role, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return finalResponse;

  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }
}
