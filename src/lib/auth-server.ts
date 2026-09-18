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

/**
 * Memverifikasi Firebase ID Token dari header Authorization
 */
export async function verifyCaller(req: Request): Promise<CallerInfo | null> {
  try {
    const token = getBearerToken(req);
    if (!token) return null;

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const email = (decoded.email || '').toLowerCase();

    // Cek koleksi admins
    const adminDoc = await adminDb.collection('admins').doc(uid).get();
    const adminData = adminDoc.exists ? adminDoc.data() : null;
    const isAdmin = adminDoc.exists || decoded.role === 'admin';
    const isSuperAdmin = isAdmin && (
      adminData?.role === 'superadmin' ||
      decoded.isSuperAdmin === true ||
      email === 'pilarss@admin.com'
    );

    let role: 'admin' | 'superadmin' | 'karyawan' | 'unknown' = 'unknown';
    if (isSuperAdmin) role = 'superadmin';
    else if (isAdmin) role = 'admin';
    else role = 'karyawan';

    return {
      uid,
      email,
      nama: adminData?.nama || decoded.name || '',
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
