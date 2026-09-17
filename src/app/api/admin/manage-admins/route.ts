import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

// Helper verifikasi pemanggil adalah Super Admin
async function verifySuperAdminCaller(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    let token = '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      // Cek apakah ada di body json jika method POST/PUT/DELETE
      return null;
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const email = (decoded.email || '').toLowerCase();

    const adminDoc = await adminDb.collection('admins').doc(uid).get();
    if (!adminDoc.exists) return null;

    const data = adminDoc.data();
    const isSuperAdmin = data?.role === 'superadmin' || decoded.isSuperAdmin === true || email === 'pilarss@admin.com';

    if (!isSuperAdmin) return null;

    return {
      uid,
      email,
      nama: data?.nama || decoded.name || 'Super Admin',
      role: 'superadmin'
    };
  } catch (err) {
    console.error('Error verifying Super Admin caller:', err);
    return null;
  }
}

// GET: Ambil seluruh daftar Admin & Super Admin
export async function GET(req: Request) {
  try {
    const caller = await verifySuperAdminCaller(req);
    if (!caller) {
      return NextResponse.json({ error: 'Akses Ditolak: Khusus Super Admin.' }, { status: 403 });
    }

    const snapshot = await adminDb.collection('admins').get();
    const admins = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        uid: doc.id,
        email: data.email || '',
        nama: data.nama || 'Administrator',
        nik: data.nik || '',
        role: data.role || 'admin',
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
      };
    });

    // Urutkan: Super Admin dulu, lalu berdasarkan nama
    admins.sort((a, b) => {
      if (a.role === 'superadmin' && b.role !== 'superadmin') return -1;
      if (a.role !== 'superadmin' && b.role === 'superadmin') return 1;
      return (a.nama || '').localeCompare(b.nama || '');
    });

    return NextResponse.json({ success: true, admins });
  } catch (error: any) {
    console.error('Error fetching admins:', error);
    return NextResponse.json({ error: error.message || 'Gagal memuat daftar admin' }, { status: 500 });
  }
}

// POST: Buat akun Admin / Super Admin baru
export async function POST(req: Request) {
  try {
    const caller = await verifySuperAdminCaller(req);
    if (!caller) {
      return NextResponse.json({ error: 'Akses Ditolak: Khusus Super Admin.' }, { status: 403 });
    }

    const { nama, nik, email, password, role } = await req.json();

    if (!nama || !nama.trim()) {
      return NextResponse.json({ error: 'Nama asli administrator wajib diisi.' }, { status: 400 });
    }

    if (!nik || !nik.trim()) {
      return NextResponse.json({ error: 'Nomor Induk Karyawan (NIK) HRD wajib diisi.' }, { status: 400 });
    }

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan kata sandi wajib diisi.' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Kata sandi minimal 6 karakter.' }, { status: 400 });
    }

    const targetRole = role === 'superadmin' ? 'superadmin' : 'admin';
    const cleanEmail = email.trim().toLowerCase();
    const cleanNik = nik.trim();

    // 1. Buat User di Firebase Auth
    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email: cleanEmail,
        password: password,
        displayName: nama.trim(),
      });
    } catch (authErr: any) {
      if (authErr.code === 'auth/email-already-exists') {
        return NextResponse.json({ error: 'Email sudah terdaftar dalam sistem.' }, { status: 400 });
      }
      throw authErr;
    }

    const newUid = userRecord.uid;

    // 2. Set Custom Claims
    await adminAuth.setCustomUserClaims(newUid, {
      role: 'admin',
      isSuperAdmin: targetRole === 'superadmin'
    });

    // 3. Simpan ke koleksi 'admins'
    const nowIso = new Date().toISOString();
    const adminData = {
      uid: newUid,
      email: cleanEmail,
      nama: nama.trim(),
      nik: cleanNik,
      role: targetRole,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await adminDb.collection('admins').doc(newUid).set(adminData);

    // 4. Catat ke Audit Log
    try {
      await adminDb.collection('audit_logs').add({
        adminEmail: caller.email,
        adminName: caller.nama,
        action: 'TAMBAH_ADMIN',
        target: `${nama} - NIK: ${cleanNik} (${cleanEmail})`,
        timestamp: new Date(),
        details: `Super Admin membuat akun ${targetRole === 'superadmin' ? 'Super Admin' : 'Admin HRD'} baru dengan NIK ${cleanNik}.`
      });
    } catch (logErr) {
      console.warn('Gagal mencatat audit log tambah admin:', logErr);
    }

    return NextResponse.json({ success: true, admin: adminData });
  } catch (error: any) {
    console.error('Error creating admin:', error);
    return NextResponse.json({ error: error.message || 'Gagal membuat akun admin' }, { status: 500 });
  }
}

// PUT: Perbarui data Admin (Nama, NIK, Role, atau Reset Password)
export async function PUT(req: Request) {
  try {
    const caller = await verifySuperAdminCaller(req);
    if (!caller) {
      return NextResponse.json({ error: 'Akses Ditolak: Khusus Super Admin.' }, { status: 403 });
    }

    const { uid, nama, nik, password, role } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: 'UID admin diperlukan.' }, { status: 400 });
    }

    const targetDoc = await adminDb.collection('admins').doc(uid).get();
    if (!targetDoc.exists) {
      return NextResponse.json({ error: 'Akun admin tidak ditemukan.' }, { status: 404 });
    }

    const currentData = targetDoc.data()!;
    const nextRole = role === 'superadmin' ? 'superadmin' : 'admin';

    // Proteksi: Jika menurunkan superadmin menjadi admin biasa, pastikan masih ada superadmin lain
    if (currentData.role === 'superadmin' && nextRole === 'admin') {
      const superAdminsSnap = await adminDb.collection('admins').where('role', '==', 'superadmin').get();
      if (superAdminsSnap.size <= 1) {
        return NextResponse.json({ error: 'Tidak dapat mengubah peran. Sistem harus memiliki minimal 1 Super Admin.' }, { status: 400 });
      }
    }

    // 1. Update di Firebase Auth
    const authUpdatePayload: any = {};
    if (nama && nama.trim() !== '') {
      authUpdatePayload.displayName = nama.trim();
    }
    if (password && password.trim() !== '') {
      if (password.length < 6) {
        return NextResponse.json({ error: 'Kata sandi baru minimal 6 karakter.' }, { status: 400 });
      }
      authUpdatePayload.password = password;
    }

    if (Object.keys(authUpdatePayload).length > 0) {
      try {
        await adminAuth.updateUser(uid, authUpdatePayload);
      } catch (authErr: any) {
        console.warn('Gagal update Firebase Auth user:', authErr);
      }
    }

    // Update custom claims jika role berubah
    if (currentData.role !== nextRole) {
      await adminAuth.setCustomUserClaims(uid, {
        role: 'admin',
        isSuperAdmin: nextRole === 'superadmin'
      });
    }

    // 2. Update di Firestore
    const updateDocPayload: any = {
      role: nextRole,
      updatedAt: new Date().toISOString()
    };
    if (nama && nama.trim() !== '') {
      updateDocPayload.nama = nama.trim();
    }
    if (nik !== undefined) {
      if (!nik.trim()) {
        return NextResponse.json({ error: 'Nomor Induk Karyawan (NIK) tidak boleh kosong.' }, { status: 400 });
      }
      updateDocPayload.nik = nik.trim();
    }

    await adminDb.collection('admins').doc(uid).update(updateDocPayload);

    // 3. Catat Audit Log
    try {
      await adminDb.collection('audit_logs').add({
        adminEmail: caller.email,
        adminName: caller.nama,
        action: 'UPDATE_ADMIN',
        target: `${nama || currentData.nama} (${currentData.email})`,
        timestamp: new Date(),
        details: `Super Admin memperbarui data akun admin (Peran: ${nextRole}${nik ? `, NIK: ${nik.trim()}` : ''}${password ? ', Password direset' : ''}).`
      });
    } catch (logErr) {
      console.warn('Gagal mencatat audit log update admin:', logErr);
    }

    return NextResponse.json({ success: true, message: 'Data admin berhasil diperbarui.' });
  } catch (error: any) {
    console.error('Error updating admin:', error);
    return NextResponse.json({ error: error.message || 'Gagal memperbarui data admin' }, { status: 500 });
  }
}

// DELETE: Hapus akun Admin
export async function DELETE(req: Request) {
  try {
    const caller = await verifySuperAdminCaller(req);
    if (!caller) {
      return NextResponse.json({ error: 'Akses Ditolak: Khusus Super Admin.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const targetUid = searchParams.get('uid');

    if (!targetUid) {
      return NextResponse.json({ error: 'UID admin diperlukan.' }, { status: 400 });
    }

    // Proteksi 1: Tidak bisa menghapus diri sendiri
    if (targetUid === caller.uid) {
      return NextResponse.json({ error: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.' }, { status: 400 });
    }

    // Proteksi 2: Cek akun target
    const targetDoc = await adminDb.collection('admins').doc(targetUid).get();
    if (!targetDoc.exists) {
      return NextResponse.json({ error: 'Akun admin tidak ditemukan.' }, { status: 404 });
    }

    const targetData = targetDoc.data()!;

    // Proteksi 3: Jika target adalah Super Admin, pastikan masih ada superadmin lain
    if (targetData.role === 'superadmin') {
      const superAdminsSnap = await adminDb.collection('admins').where('role', '==', 'superadmin').get();
      if (superAdminsSnap.size <= 1) {
        return NextResponse.json({ error: 'Tidak dapat menghapus satu-satunya Super Admin dalam sistem.' }, { status: 400 });
      }
    }

    // 1. Hapus dari Firebase Auth
    try {
      await adminAuth.deleteUser(targetUid);
    } catch (authErr: any) {
      console.warn('User not found in Auth or failed to delete:', authErr.message);
    }

    // 2. Hapus dari Firestore
    await adminDb.collection('admins').doc(targetUid).delete();

    // 3. Catat ke Audit Log
    try {
      await adminDb.collection('audit_logs').add({
        adminEmail: caller.email,
        adminName: caller.nama,
        action: 'HAPUS_ADMIN',
        target: `${targetData.nama || 'Admin'} (${targetData.email})`,
        timestamp: new Date(),
        details: `Super Admin mencabut akses dan menghapus akun ${targetData.role === 'superadmin' ? 'Super Admin' : 'Admin HRD'}.`
      });
    } catch (logErr) {
      console.warn('Gagal mencatat audit log hapus admin:', logErr);
    }

    return NextResponse.json({ success: true, message: 'Akun admin berhasil dihapus.' });
  } catch (error: any) {
    console.error('Error deleting admin:', error);
    return NextResponse.json({ error: error.message || 'Gagal menghapus admin' }, { status: 500 });
  }
}
