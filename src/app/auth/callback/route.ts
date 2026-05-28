import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=missing_code`);
  }

  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  // 1. Exchange OAuth code for token session
  const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !session) {
    console.error('Session exchange error:', exchangeError);
    return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=auth_failed`);
  }

  try {
    // 2. Fetch the profile (Guaranteed to be there via the Postgres trigger)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=profile_not_found`);
    }

    const role = profile.role;
    const allowedRoles = ['teacher', 'admin', 'super_admin', 'academy'];
    
    if (!allowedRoles.includes(role)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=unauthorized_role`);
    }

    // 3. Set cookie and redirect user seamlessly
    const redirectUrl = role === 'admin' || role === 'super_admin' ? '/admin' : '/dashboard';
    const response = NextResponse.redirect(`${requestUrl.origin}${redirectUrl}`);

    response.cookies.set('role', role, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 Days
      httpOnly: false,
      sameSite: 'lax',
    });

    return response;

  } catch (error) {
    console.error('Callback runtime error:', error);
    return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=server_error`);
  }
}