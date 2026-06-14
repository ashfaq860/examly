// app/api/auth/callback/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

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

  // ------------------------------------------------------------------
  // Guard: no code means the OAuth flow was never started or was
  // interrupted (e.g. user closed the Google popup).
  // ------------------------------------------------------------------
  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  // ------------------------------------------------------------------
  // Step 1: Exchange the one-time code for a real session.
  //   This MUST use the cookie-based client so the session is stored
  //   in the response cookies and subsequent server calls are auth'd.
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // Step 2: Look up (or create) the user's profile using the admin
  //   client so RLS never blocks us on a brand-new user's first login.
  // ------------------------------------------------------------------
  try {
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
      // ------------------------------------------------------------------
      // New user — insert a profile and default them to "teacher".
      // ------------------------------------------------------------------
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
        return NextResponse.redirect(
          `${origin}/auth/login?error=profile_creation_failed`
        );
      }
    } else {
      role = existingProfile.role ?? 'teacher';
    }

    // ------------------------------------------------------------------
    // Step 3: Authorisation check — only portal-approved roles may enter.
    // ------------------------------------------------------------------
    if (!isAllowedRole(role)) {
      console.error('Unauthorized role via OAuth:', role);
      // Sign out using the cookie client so the session cookie is cleared.
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/auth/login?error=unauthorized_role`);
    }

    // ------------------------------------------------------------------
    // Step 4: Build the redirect response.
    //
    // FIX 1: Explicitly delete any stale Supabase auth cookies on the
    //   response BEFORE setting the role cookie. This ensures that when
    //   a user logs out and immediately logs in with a different Google
    //   account, the old session tokens do not linger and cause the app
    //   to think the previous user is still active.
    //
    //   We also set SameSite=Lax (not Strict) so the cookie survives the
    //   cross-site redirect back from Google.
    // ------------------------------------------------------------------
    const redirectPath = getRedirectPath(role);
    const response = NextResponse.redirect(`${origin}${redirectPath}`);

    // Clear any stale auth tokens from a previous session.
    // Supabase names these cookies after your project ref; the wildcard
    // pattern below covers both the access-token and refresh-token cookies
    // regardless of your project ref prefix.
    const cookieHeader = request.headers.get('cookie') ?? '';
    const staleCookieNames = cookieHeader
      .split(';')
      .map((c) => c.trim().split('=')[0])
      .filter((name) => name.startsWith('sb-') && name.endsWith('-auth-token'));

    for (const name of staleCookieNames) {
      response.cookies.delete(name);
    }

    // Set the role cookie so middleware and client code can read it
    // without an extra DB round-trip.
    response.cookies.set('role', role, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: false,           // Must be readable by JS (js-cookie on the client)
      sameSite: 'lax',           // Required to survive the OAuth redirect
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }
}