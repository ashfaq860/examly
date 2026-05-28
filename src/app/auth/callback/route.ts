// app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=missing_code`);
  }

  const cookieStore = await cookies();

  // Use @supabase/ssr which correctly handles cookie read/write in Next.js 15
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

  // exchangeCodeForSession writes the session cookies via setAll above
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

    const redirectPath = role === 'admin' || role === 'super_admin' ? '/admin' : '/dashboard';

    // Build the redirect response. The session cookies were already written to
    // cookieStore by exchangeCodeForSession — Next.js will include them in the
    // response automatically since we used the async cookies() store.
    const response = NextResponse.redirect(`${requestUrl.origin}${redirectPath}`);

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