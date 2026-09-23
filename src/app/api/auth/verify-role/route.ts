import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

// Fallback verifikasi token via Google Identity Toolkit REST API
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
    console.warn("verifyTokenFallback error in verify-role:", err);
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    let uid = '';
    let email = '';
    let tokenName = '';
    let tokenRole: string | undefined;
    let tokenIsSuperAdmin: boolean | undefined;

    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      uid = decodedToken.uid;
      email = (decodedToken.email || '').toLowerCase();
      tokenName = decodedToken.name || '';
      tokenRole = decodedToken.role;
      tokenIsSuperAdmin = decodedToken.isSuperAdmin;
    } catch (adminErr) {
      console.warn("adminAuth in verify-role failed, attempting Google Identity REST API:", adminErr);
      const fallbackUser = await verifyTokenFallback(idToken);
      if (fallbackUser) {
        uid = fallbackUser.uid;
        email = fallbackUser.email;
        tokenName = fallbackUser.name;
      } else {
        throw new Error("Token autentikasi tidak valid atau telah kedaluwarsa.");
      }
    }

    // Parallel check for admins and employees
    let adminData: any = null;
    let employeeData: any = null;
    let isAdmin = tokenRole === 'admin' || email === 'pilarss@admin.com';
    let isEmployee = false;

    try {
      const [adminDoc, empDoc] = await Promise.all([
        adminDb.collection('admins').doc(uid).get().catch(() => null),
        adminDb.collection('employees').doc(uid).get().catch(() => null),
      ]);

      if (adminDoc?.exists) {
        adminData = adminDoc.data();
        isAdmin = true;
      }

      if (empDoc?.exists) {
        employeeData = empDoc.data();
        isEmployee = true;
      } else if (email && !isAdmin) {
        const empQuery = await adminDb.collection('employees').where('email', '==', email).limit(1).get().catch(() => null);
        if (empQuery && !empQuery.empty) {
          isEmployee = true;
          employeeData = empQuery.docs[0].data();
        }
      }
    } catch (dbErr) {
      console.warn("Firestore query in verify-role warning:", dbErr);
    }

    const isSuperAdmin = isAdmin && (adminData?.role === 'superadmin' || tokenIsSuperAdmin === true || email === 'pilarss@admin.com');
    const adminRole = isSuperAdmin ? 'superadmin' : (isAdmin ? 'admin' : null);

    return NextResponse.json({
      success: true,
      uid,
      email,
      nama: adminData?.nama || employeeData?.nama || tokenName || '',
      nik: adminData?.nik || employeeData?.nik || employeeData?.noInduk || '',
      isAdmin,
      isSuperAdmin: !!isSuperAdmin,
      adminRole: adminRole || (isAdmin ? 'admin' : null),
      isEmployee,
      employeeStatus: employeeData?.status || null,
      role: isAdmin ? 'admin' : (isEmployee ? 'karyawan' : 'unknown')
    });
  } catch (error: any) {
    console.error('Verify role error:', error);
    const status = error?.code?.startsWith('auth/') ? 401 : 500;
    return NextResponse.json({ error: error.message || 'Token verification failed' }, { status });
  }
}

