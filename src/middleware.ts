// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const userRole = request.cookies.get('role')?.value;

  // Restrict /admin to admin role
  if (request.nextUrl.pathname.startsWith('/admin') && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
