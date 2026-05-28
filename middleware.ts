import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Use auth-helpers-nextjs — same library as the client components.
  // This reads/writes the chunked cookie format that auth-helpers uses,
  // ensuring the token refresh works correctly and the refreshed token
  // is available to Route Handlers via the same cookie format.
  const supabase = createMiddlewareClient({ req, res });

  // Refresh the session on every request. This writes updated Set-Cookie
  // headers onto `res` when the access token is near expiry.
  const { data: { session } } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  // ── Unauthenticated access to protected PAGE routes ─────────────────────
  // API routes return 401 JSON from the route handler — don't redirect them
  // to the login page (that would return HTML instead of JSON).
  const isProtectedPage =
    pathname.startsWith('/dashboard') || pathname.startsWith('/admin');

  if (isProtectedPage && !session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/auth/login';
    return NextResponse.redirect(loginUrl);
  }

  // ── Role-based protection for /admin page routes ─────────────────────────
  if (pathname.startsWith('/admin') && !pathname.startsWith('/api/') && session) {
    const roleCookie = req.cookies.get('role')?.value;
    if (roleCookie !== 'admin' && roleCookie !== 'super_admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return res;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/auth/callback',
    '/api/:path*',
  ],
};
