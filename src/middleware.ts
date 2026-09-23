import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const adminSession = request.cookies.get('pilar_admin_session')?.value;

  // 1. Protect Admin routes (/admin and /admin/* except /admin/login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!adminSession) {
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. If already logged in as admin and visits /admin/login, redirect to /admin unless logout requested
  if (pathname === '/admin/login') {
    if (searchParams.has('logout')) {
      const res = NextResponse.next();
      res.cookies.delete('pilar_admin_session');
      res.cookies.delete('pilar_admin_role');
      return res;
    }
    if (adminSession) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
  ],
};
