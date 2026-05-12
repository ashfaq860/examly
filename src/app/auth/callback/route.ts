// app/auth/callback/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // 1. Exchange the code for a session (This sets the auth cookies)
    const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError || !session) {
      console.error('Session exchange error:', exchangeError);
      return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=auth_failed`);
    }

    try {
      // 2. Ensure user profile exists with default role
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', session.user.id)
        .single();

      if (!existingProfile) {
        // Create profile with default role 'teacher' for new OAuth users
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            email: session.user.email,
            full_name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            role: 'teacher', // Default role for OAuth users
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('Profile creation error:', insertError);
          // Still redirect even if profile creation fails - user can complete profile later
        }
      }

      // 3. Fetch the user role (Using your RPC)
      const { data: roleData, error: rpcError } = await supabase
        .rpc('get_user_role', { user_id: session.user.id });

      if (rpcError) {
        console.error('RPC error:', rpcError);
        return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=role_fetch_failed`);
      }

      const role = (roleData as any)?.role || roleData || 'teacher';

      // 4. Prepare the redirect response
      const redirectUrl = (role === 'admin' || role === 'super_admin') ? '/admin' : '/dashboard';
      const response = NextResponse.redirect(`${requestUrl.origin}${redirectUrl}`);

      // 5. Set your custom role cookie on the server response
      response.cookies.set('role', role, { 
        path: '/', 
        maxAge: 60 * 60 * 24 * 7 // 7 days
      });

      return response;
    } catch (error) {
      console.error('Callback error:', error);
      return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=auth_failed`);
    }
  }

  // If something goes wrong, send them back to login
  return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=missing_code`);
}