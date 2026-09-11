import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { nama, email, password, posisi, status, lokasiId, gajiPokok, id, shiftMasuk, shiftKeluar, noInduk, noWa, bpjsTk, bpjsKes } = data;

    if (!email || !nama) {
      return NextResponse.json({ error: 'Email and name are required' }, { status: 400 });
    }

    let uid = id;
    let userRecord;
    
    if (uid) {
      // Update existing user
      const updatePayload: any = {
        email: email,
        displayName: nama,
      };
      // Jika password diisi, maka update password
      if (password && password.trim() !== '') {
        updatePayload.password = password;
      }
      try {
        userRecord = await adminAuth.updateUser(uid, updatePayload);
      } catch (authErr: any) {
        if (authErr.code === 'auth/user-not-found') {
           // Fallback jika tidak ada di Auth, tapi mau diupdate
           if (!password) {
             return NextResponse.json({ error: 'Password required for new user' }, { status: 400 });
           }
           userRecord = await adminAuth.createUser({
             uid: uid,
             email: email,
             password: password,
             displayName: nama,
           });
        } else {
           throw authErr;
        }
      }
    } else {
      // Create new user
      if (!password) {
        return NextResponse.json({ error: 'Kata sandi wajib diisi' }, { status: 400 });
      }
      if (password.length < 6) {
        return NextResponse.json({ error: 'Kata sandi minimal harus 6 karakter' }, { status: 400 });
      }

      try {
        userRecord = await adminAuth.createUser({
          email: email,
          password: password,
          displayName: nama,
        });
        uid = userRecord.uid;
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-exists' || authErr.code === 'auth/email-already-in-use') {
          // Check if employee already exists in Firestore
          const existingUser = await adminAuth.getUserByEmail(email);
          const empDoc = await adminDb.collection('employees').doc(existingUser.uid).get();
          if (!empDoc.exists) {
            // Orphaned Auth user without Firestore employee doc! Re-use this auth user!
            uid = existingUser.uid;
            await adminAuth.updateUser(uid, {
              displayName: nama,
              password: password,
            });
          } else {
            return NextResponse.json({ error: 'Email ini sudah digunakan oleh akun karyawan lain. Silakan gunakan email lain.' }, { status: 400 });
          }
        } else {
          throw authErr;
        }
      }
    }

    // Save Employee Data to Firestore (exclude password)
    const employeeData: any = {
      nama,
      noInduk: noInduk || "",
      noWa: noWa || "",
      email,
      posisi: posisi || "",
      status: status || "Aktif",
      lokasiId: lokasiId || "all",
      shiftMasuk: shiftMasuk || "08:00",
      shiftKeluar: shiftKeluar || "17:00",
      gajiPokok: Number(gajiPokok) || 0,
      bpjsTk: bpjsTk !== undefined ? Boolean(bpjsTk) : true,
      bpjsKes: bpjsKes !== undefined ? Boolean(bpjsKes) : true,
      updatedAt: new Date().toISOString(),
    };

    if (!id) {
      employeeData.createdAt = new Date().toISOString();
    }

    await adminDb.collection('employees').doc(uid).set(employeeData, { merge: true });

    return NextResponse.json({ success: true, uid, message: 'Employee saved successfully' });
  } catch (error: any) {
    console.error('Error saving employee:', error);
    let errorMsg = error.message || 'Terjadi kesalahan pada server';
    let statusCode = 500;

    if (error.code === 'auth/email-already-exists' || error.code === 'auth/email-already-in-use') {
      errorMsg = 'Email ini sudah terdaftar. Silakan gunakan email lain.';
      statusCode = 400;
    } else if (error.code === 'auth/invalid-email') {
      errorMsg = 'Format email tidak valid.';
      statusCode = 400;
    } else if (error.code === 'auth/weak-password' || error.message?.includes('at least 6 characters')) {
      errorMsg = 'Kata sandi minimal harus 6 karakter.';
      statusCode = 400;
    } else if (error.code === 'auth/invalid-password') {
      errorMsg = 'Kata sandi tidak valid. Minimal 6 karakter.';
      statusCode = 400;
    }

    return NextResponse.json({ error: errorMsg }, { status: statusCode });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');
    
    if (!uid) {
      return NextResponse.json({ error: 'UID is required' }, { status: 400 });
    }

    try {
      await adminAuth.deleteUser(uid);
    } catch(err: any) {
      // Ignore if user already not in auth
      console.log("Auth user delete error or not found:", err.message);
    }
    
    await adminDb.collection('employees').doc(uid).delete();

    return NextResponse.json({ success: true, message: 'Employee deleted' });
  } catch (error: any) {
    console.error('Error deleting employee:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
