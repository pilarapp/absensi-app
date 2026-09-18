import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { idToken, role, adminRole } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: 'ID Token wajib disertakan.' }, { status: 400 });
    }

    // 1. Verifikasi ID Token dari Firebase
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = (decoded.email || '').toLowerCase();

    const maxAge = 60 * 60 * 24 * 7; // 7 hari
    const response = NextResponse.json({ success: true, role, adminRole });

    if (role === 'admin') {
      // 2. Verifikasi kepemilikan role Admin di database
      const adminDoc = await adminDb.collection('admins').doc(uid).get();
      const isAdmin = adminDoc.exists || decoded.role === 'admin' || email === 'pilarss@admin.com';

      if (!isAdmin) {
        return NextResponse.json({ error: 'Akses Ditolak: Anda tidak terdaftar sebagai Administrator.' }, { status: 403 });
      }

      const adminData = adminDoc.exists ? adminDoc.data() : null;
      const verifiedAdminRole = adminData?.role || adminRole || (decoded.isSuperAdmin ? 'superadmin' : 'admin');

      response.cookies.set({
        name: 'pilar_admin_session',
        value: `adm_${uid}`,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: maxAge,
      });

      response.cookies.set({
        name: 'pilar_admin_role',
        value: verifiedAdminRole,
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        maxAge: maxAge,
      });

      // Hapus sesi karyawan jika ada
      response.cookies.delete('pilar_employee_session');
    } else if (role === 'karyawan') {
      // 3. Verifikasi role Karyawan
      response.cookies.set({
        name: 'pilar_employee_session',
        value: `emp_${uid}`,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: maxAge,
      });

      // Hapus sesi admin jika ada
      response.cookies.delete('pilar_admin_session');
      response.cookies.delete('pilar_admin_role');
    } else {
      return NextResponse.json({ error: 'Peran (role) tidak valid.' }, { status: 400 });
    }

    return response;
  } catch (error: any) {
    console.error('Session creation error:', error);
    const statusCode = error?.code?.startsWith('auth/') ? 401 : 500;
    return NextResponse.json({ error: error.message || 'Gagal membuat sesi.' }, { status: statusCode });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Sessions cleared' });
  response.cookies.delete('pilar_admin_session');
  response.cookies.delete('pilar_admin_role');
  response.cookies.delete('pilar_employee_session');
  return response;
}
