// app/auth/callback/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type AllowedRole = 'teacher' | 'admin' | 'super_admin' | 'academy';

const ALLOWED_ROLES: AllowedRole[] = ['teacher', 'admin', 'super_admin', 'academy'];

function getRoleRedirectPath(role: string): string {
  if (role === 'admin' || role === 'super_admin') return '/admin';
  return '/dashboard';
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=missing_code`);
  }

  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  const { data: { session }, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !session) {
    console.error('Session exchange error:', exchangeError);
    return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=auth_failed`);
  }

  try {
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=profile_fetch_failed`);
    }

    let role: string = 'teacher';

    if (!existingProfile) {
      const { error: insertError } = await supabase.from('profiles').insert({
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
        console.error('Profile creation error:', insertError);
        return NextResponse.redirect(
          `${requestUrl.origin}/auth/login?error=profile_creation_failed`
        );
      }
      // New users are always teachers
      role = 'teacher';
    } else {
      // ✅ Use the role exactly as stored in DB — no fallback that could mask bugs
      role = existingProfile.role;
    }

    if (!ALLOWED_ROLES.includes(role as AllowedRole)) {
      console.error('Unauthorized role via OAuth:', role);
      await supabase.auth.signOut();
      return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=unauthorized_role`);
    }

    // ✅ Single source of truth for role → path mapping
    const redirectPath = getRoleRedirectPath(role);

    const response = NextResponse.redirect(`${requestUrl.origin}${redirectPath}`, {
      status: 302,
    });

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
    return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=auth_failed`);
  }
}