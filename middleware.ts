import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Build a Supabase client that can read/write cookies on the response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          ),
      },
    }
  );

  // Refresh the session on every request — this keeps the access token
  // fresh and syncs the session cookies to the browser.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  // ── Unauthenticated access to protected routes ──────────────────────────
  const isProtected =
    pathname.startsWith('/dashboard') || pathname.startsWith('/admin');

  if (isProtected && !session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/auth/login';
    return NextResponse.redirect(loginUrl);
  }

  // ── Role-based protection for /admin ────────────────────────────────────
  // We check the role cookie (set by the callback route) as a fast first
  // gate. The actual admin pages also call requireRole() server-side, so
  // a forged cookie only gets past this middleware check — not the API.
  if (pathname.startsWith('/admin') && session) {
    const roleCookie = req.cookies.get('role')?.value;
    if (roleCookie !== 'admin' && roleCookie !== 'super_admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/auth/callback'],
};
