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

  // ✅ FIX 1: Do NOT await cookies() — pass it as a callback reference
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !session) {
    console.error('Session exchange error:', exchangeError);
    return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=auth_failed`);
  }

  try {
    // ✅ FIX 2: Use maybeSingle() instead of single() to avoid throwing on missing rows
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', session.user.id)
      .maybeSingle();

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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error('Profile creation error:', insertError);
      }
    }

    // ✅ FIX 3: Normalize role resolution — don't rely on ambiguous shape fallback
    const { data: roleData, error: rpcError } = await supabase
      .rpc('get_user_role', { user_id: session.user.id });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=role_fetch_failed`);
    }

    // Safely extract role regardless of whether RPC returns { role: "..." } or "..."
    let role: string = 'teacher';
    if (typeof roleData === 'string') {
      role = roleData;
    } else if (roleData && typeof roleData === 'object' && 'role' in roleData) {
      role = (roleData as { role: string }).role;
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
      httpOnly: false, // keep false so client JS (js-cookie) can read it
      sameSite: 'lax',
    });

    return response;

  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=auth_failed`);
  }
}