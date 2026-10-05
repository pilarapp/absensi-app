import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';

  // 0. Deteksi Subdomain Admin dan Rewrite URL
  // Jika diakses dari admin.pilarsentrasolusi.com, arahkan secara internal ke folder /admin
  const isAdminSubdomain = hostname === 'admin.pilarsentrasolusi.com';
  
  if (isAdminSubdomain) {
    // Jika belum ada awalan /admin, tambahkan secara virtual (rewrite)
    if (!url.pathname.startsWith('/admin')) {
      url.pathname = `/admin${url.pathname === '/' ? '' : url.pathname}`;
    }
  }

  const { pathname, searchParams } = url;
  const adminSession = request.cookies.get('pilar_admin_session')?.value;

  // 1. Proteksi Halaman Admin
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!adminSession) {
      // Jika belum login, lempar ke halaman login
      const loginUrl = request.nextUrl.clone();
      // Jika lewat subdomain, arahkannya ke /login (karena /login akan di-rewrite jadi /admin/login di atas)
      loginUrl.pathname = isAdminSubdomain ? '/login' : '/admin/login';
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Proteksi Halaman Login Admin (jika sudah login atau mau logout)
  if (pathname === '/admin/login') {
    if (searchParams.has('logout')) {
      // Hapus sesi dan lanjutkan prosesnya
      const res = url.pathname !== request.nextUrl.pathname 
        ? NextResponse.rewrite(url) 
        : NextResponse.next();
      res.cookies.delete('pilar_admin_session');
      res.cookies.delete('pilar_admin_role');
      return res;
    }
    if (adminSession) {
      // Jika sudah login tapi buka halaman login, lempar ke dashboard admin
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = isAdminSubdomain ? '/' : '/admin';
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // 3. Eksekusi Subdomain Rewrite
  if (url.pathname !== request.nextUrl.pathname) {
     return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Middleware berjalan di semua path KECUALI file aset statis (gambar, css, js)
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
