// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_ROLES = ['admin', 'super_admin'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userRole = request.cookies.get('role')?.value;

  // Protect /admin — only admin and super_admin may enter
  if (pathname.startsWith('/admin')) {
    if (!userRole || !ADMIN_ROLES.includes(userRole)) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};