import { adminAuth, adminDb } from '@/lib/firebase-admin';

export interface CallerInfo {
  uid: string;
  email: string;
  nama?: string;
  nik?: string;
  role: 'admin' | 'superadmin' | 'karyawan' | 'unknown';
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
}

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
    console.warn("verifyTokenFallback in auth-server error:", err);
  }
  return null;
}

/**
 * Memverifikasi Firebase ID Token dari header Authorization
 */
export async function verifyCaller(req: Request): Promise<CallerInfo | null> {
  try {
    const token = getBearerToken(req);
    if (!token) return null;

    let uid = '';
    let email = '';
    let tokenName = '';
    let tokenRole: string | undefined;
    let tokenIsSuperAdmin: boolean | undefined;

    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
      email = (decoded.email || '').toLowerCase();
      tokenName = decoded.name || '';
      tokenRole = decoded.role;
      tokenIsSuperAdmin = decoded.isSuperAdmin;
    } catch (adminErr) {
      console.warn("adminAuth.verifyIdToken notice in auth-server, attempting Google REST lookup:", adminErr);
      const fallbackUser = await verifyTokenFallback(token);
      if (fallbackUser) {
        uid = fallbackUser.uid;
        email = fallbackUser.email;
        tokenName = fallbackUser.name;
      } else {
        return null;
      }
    }

    // Cek koleksi admins secara aman
    let adminData: any = null;
    let isAdmin = tokenRole === 'admin' || email === 'pilarss@admin.com';
    let isSuperAdmin = tokenIsSuperAdmin === true || email === 'pilarss@admin.com';

    try {
      const adminDoc = await adminDb.collection('admins').doc(uid).get();
      if (adminDoc.exists) {
        adminData = adminDoc.data();
        isAdmin = true;
        if (adminData?.role === 'superadmin') {
          isSuperAdmin = true;
        }
      }
    } catch (dbErr) {
      // Abaikan jika Firestore serverless belum terhubung
      console.warn("adminDb check notice in auth-server:", dbErr);
    }

    let role: 'admin' | 'superadmin' | 'karyawan' | 'unknown' = 'unknown';
    if (isSuperAdmin) role = 'superadmin';
    else if (isAdmin) role = 'admin';
    else role = 'karyawan';

    return {
      uid,
      email,
      nama: adminData?.nama || tokenName || '',
      nik: adminData?.nik || '',
      role,
      isAdmin,
      isSuperAdmin,
    };
  } catch (error) {
    console.warn('verifyCaller error:', error);
    return null;
  }
}

/**
 * Memverifikasi pemanggil memiliki hak akses Admin atau Super Admin
 */
export async function verifyAdminCaller(req: Request): Promise<CallerInfo | null> {
  const caller = await verifyCaller(req);
  if (!caller || !caller.isAdmin) {
    return null;
  }
  return caller;
}

/**
 * Memverifikasi pemanggil memiliki hak akses Super Admin
 */
export async function verifySuperAdminCaller(req: Request): Promise<CallerInfo | null> {
  const caller = await verifyCaller(req);
  if (!caller || !caller.isSuperAdmin) {
    return null;
  }
  return caller;
}
