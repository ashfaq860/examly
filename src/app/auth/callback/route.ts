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

  const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

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

    // ✅ FIX 1: Track whether this is a new user
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error('Profile creation error:', insertError);
        // ✅ FIX 2: Don't continue if insert failed — redirect to login
        return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=profile_creation_failed`);
      }
    }

    // ✅ FIX 3: For brand-new users, skip the RPC entirely — we JUST set role: 'teacher'
    // For existing users, use the RPC as before
    let role: string = 'teacher';

    if (!isNewUser) {
      // ✅ FIX 4: First try reading role directly from the profile we already fetched
      // This avoids a redundant RPC round-trip and any propagation delay
      if (existingProfile?.role) {
        role = existingProfile.role;
      } else {
        // Fall back to RPC only if profile row had no role column
        const { data: roleData, error: rpcError } = await supabase
          .rpc('get_user_role', { user_id: session.user.id });

        if (rpcError) {
          console.error('RPC error:', rpcError);
          return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=role_fetch_failed`);
        }

        if (typeof roleData === 'string') {
          role = roleData;
        } else if (roleData && typeof roleData === 'object' && 'role' in roleData) {
          role = (roleData as { role: string }).role;
        }
      }
    }

    const allowedRoles = ['teacher', 'admin', 'super_admin', 'academy'];
    if (!allowedRoles.includes(role)) {
      console.error('Unauthorized role via OAuth:', role);
      await supabase.auth.signOut();
      return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=unauthorized_role`);
    }

    const redirectUrl = role === 'admin' || role === 'super_admin' ? '/admin' : '/dashboard';
    const response = NextResponse.redirect(`${requestUrl.origin}${redirectUrl}`);

    response.cookies.set('role', role, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: false,
      sameSite: 'lax',
    });

    return response;

  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=auth_failed`);
  }
}