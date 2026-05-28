import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Refresh the session and sync cookies on every request.
  // This is critical — it ensures the access token is refreshed and the
  // session cookies are forwarded to the browser before any redirect happens.
  const { data: { session } } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  // Protect dashboard and admin routes
  const isProtected = pathname.startsWith('/dashboard') || pathname.startsWith('/admin');
  if (isProtected && !session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/auth/login';
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/auth/callback'],
};
