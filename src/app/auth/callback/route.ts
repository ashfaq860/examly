// app/auth/callback/route.ts
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

  const {
    data: { session },
    error: exchangeError,
  } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !session) {
    console.error('Session exchange error:', exchangeError);
    return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=auth_failed`);
  }

  try {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', session.user.id)
      .maybeSingle();

    let role: string = 'teacher';
    let isNewUser = false;

    if (!existingProfile) {
      isNewUser = true;
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
    } else {
      role = existingProfile.role ?? 'teacher';
    }

    const allowedRoles = ['teacher', 'admin', 'super_admin', 'academy'];
    if (!allowedRoles.includes(role)) {
      console.error('Unauthorized role via OAuth:', role);
      await supabase.auth.signOut();
      return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=unauthorized_role`);
    }

    const redirectPath = role === 'admin' || role === 'super_admin' ? '/admin' : '/dashboard';

    // ✅ KEY FIX: Use 302 redirect with role cookie baked in
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