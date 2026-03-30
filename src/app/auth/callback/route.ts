// app/auth/callback/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // 1. Exchange the code for a session (This sets the auth cookies)
    const { data: { session } } = await supabase.auth.exchangeCodeForSession(code);

    if (session) {
      // 2. Fetch the user role (Using your RPC)
      const { data: roleData } = await supabase
        .rpc('get_user_role', { user_id: session.user.id });

      const role = (roleData as any)?.role || roleData;

      // 3. Prepare the redirect response
      const redirectUrl = role === 'admin' ? '/admin' : '/dashboard';
      const response = NextResponse.redirect(`${requestUrl.origin}${redirectUrl}`);

      // 4. Set your custom role cookie on the server response
      response.cookies.set('role', role, { 
        path: '/', 
        maxAge: 60 * 60 * 24 * 7 // 7 days
      });

      return response;
    }
  }

  // If something goes wrong, send them back to login
  return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=auth_failed`);
}