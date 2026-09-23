import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

// Fallback verifikasi token via Google Identity Toolkit REST API
// Bekerja langsung menggunakan NEXT_PUBLIC_FIREBASE_API_KEY tanpa ketergantungan Service Account
async function verifyTokenFallback(idToken: string) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.users && data.users.length > 0) {
      const u = data.users[0];
      return {
        uid: u.localId,
        email: (u.email || '').toLowerCase(),
        name: u.displayName || '',
      };
    }
  } catch (err) {
    console.warn("verifyTokenFallback error:", err);
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { idToken, role, adminRole, uid: clientUid } = await req.json();

    if (!idToken && !clientUid) {
      return NextResponse.json({ error: 'ID Token atau UID wajib disertakan.' }, { status: 400 });
    }

    let uid = clientUid || '';
    let email = '';

    // 1. Verifikasi ID Token via Admin SDK, atau fallback ke Google REST API
    if (idToken) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        uid = decoded.uid;
        email = (decoded.email || '').toLowerCase();
      } catch (adminErr) {
        console.warn("adminAuth.verifyIdToken notice in session, attempting Google REST lookup:", adminErr);
        const fallbackUser = await verifyTokenFallback(idToken);
        if (fallbackUser) {
          uid = fallbackUser.uid;
          email = fallbackUser.email;
        } else if (!uid) {
          throw new Error("Token autentikasi tidak valid atau telah kedaluwarsa.");
        }
      }
    }

    const maxAge = 60 * 60 * 24 * 7; // 7 hari
    const response = NextResponse.json({ success: true, role, adminRole, uid });

    if (role === 'admin') {
      let isSuperAdmin = adminRole === 'superadmin' || email === 'pilarss@admin.com';
      let verifiedAdminRole = isSuperAdmin ? 'superadmin' : (adminRole || 'admin');

      // Cek Firestore adminDb jika tersedia
      try {
        const adminDoc = await adminDb.collection('admins').doc(uid).get();
        if (adminDoc.exists) {
          const admData = adminDoc.data();
          if (admData?.role === 'superadmin') {
            isSuperAdmin = true;
            verifiedAdminRole = 'superadmin';
          }
        }
      } catch (dbErr) {
        // Fallback: gunakan verifiedAdminRole dari payload jika adminDb serverless belum terhubung
        console.warn("adminDb lookup warning in session route:", dbErr);
      }

      response.cookies.set({
        name: 'pilar_admin_session',
        value: `adm_${uid}`,
        path: '/',
        httpOnly: false,
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
      // Verifikasi role Karyawan
      response.cookies.set({
        name: 'pilar_employee_session',
        value: `emp_${uid}`,
        path: '/',
        httpOnly: false,
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
    return NextResponse.json({ error: 'Gagal membuat sesi.' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Sessions cleared' });
  response.cookies.delete('pilar_admin_session');
  response.cookies.delete('pilar_admin_role');
  response.cookies.delete('pilar_employee_session');
  return response;
}

