// app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['teacher', 'admin', 'super_admin', 'academy'] as const;
type UserRole = (typeof ALLOWED_ROLES)[number];

function isAllowedRole(role: string): role is UserRole {
  return ALLOWED_ROLES.includes(role as UserRole);
}

function getRedirectPath(role: UserRole): string {
  return role === 'admin' || role === 'super_admin' ? '/admin' : '/dashboard';
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  const cookieStore = await cookies();

  // ✅ Use @supabase/ssr — stores & reads PKCE verifier in cookies,
  // which is the same storage the client-side createBrowserClient uses.
  // This is what fixes the AuthPKCECodeVerifierMissingError.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  // Exchange code → session. PKCE verifier is now read from cookies ✅
  const {
    data: { session },
    error: exchangeError,
  } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !session) {
    console.error('Session exchange error:', exchangeError);
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  const userId = session.user.id;
  const userEmail = session.user.email ?? '';

  try {
    // Use admin client to bypass RLS — safe for new users on first login
    const { data: existingProfile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Profile fetch error:', fetchError);
      return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
    }

    let role: string = 'teacher';

    if (!existingProfile) {
      const fullName =
        session.user.user_metadata?.name ||
        session.user.user_metadata?.full_name ||
        userEmail.split('@')[0] ||
        'User';

      const { error: insertError } = await supabaseAdmin.from('profiles').insert({
        id: userId,
        email: userEmail,
        full_name: fullName,
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

    if (!isAllowedRole(role)) {
      console.error('Unauthorized role via OAuth:', role);
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/auth/login?error=unauthorized_role`);
    }

    const redirectPath = getRedirectPath(role);
    const response = NextResponse.redirect(`${origin}${redirectPath}`);

    // Forward the session cookies set by @supabase/ssr onto the response
    // so the browser actually receives them after the redirect.
    cookieStore.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
      });
    });

    // Role cookie — readable by JS (middleware, js-cookie)
    response.cookies.set('role', role, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }
}