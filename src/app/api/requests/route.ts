import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyCaller } from '@/lib/auth-server';

/**
 * PUT /api/requests
 * Memperbarui / Mengedit pengajuan (misal: pengajuan revisi oleh karyawan)
 */
export async function PUT(req: Request) {
  try {
    const caller = await verifyCaller(req);
    if (!caller) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Anda harus login untuk memperbarui pengajuan.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { requestId, updateData } = body;

    if (!requestId || !updateData) {
      return NextResponse.json(
        { error: 'Parameter requestId dan updateData wajib disertakan.' },
        { status: 400 }
      );
    }

    const reqRef = adminDb.collection('requests').doc(requestId);
    const reqDoc = await reqRef.get();

    if (!reqDoc.exists) {
      return NextResponse.json(
        { error: 'Pengajuan tidak ditemukan.' },
        { status: 404 }
      );
    }

    const currentData = reqDoc.data() || {};

    // Validasi wewenang: Admin bebas edit, Karyawan hanya boleh edit pengajuan miliknya
    const isOwner = 
      currentData.karyawanId === caller.uid || 
      currentData.karyawanEmail === caller.email ||
      (currentData.karyawanNik && currentData.karyawanNik === caller.nik);

    if (!caller.isAdmin && !isOwner) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Anda hanya dapat memperbarui pengajuan milik Anda sendiri.' },
        { status: 403 }
      );
    }

    // Bersihkan field agar tidak merusak relasi pemilik
    const sanitizedUpdate = { ...updateData };
    delete sanitizedUpdate.id;
    delete sanitizedUpdate.karyawanId; // Jangan izinkan ganti pemilik
    sanitizedUpdate.updatedAt = new Date().toISOString();

    await reqRef.update(sanitizedUpdate);

    return NextResponse.json({
      success: true,
      message: 'Pengajuan berhasil diperbarui.',
    });
  } catch (error: any) {
    console.error('Error PUT /api/requests:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal memperbarui pengajuan.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/requests
 * Mengubah status pengajuan (Setujui, Tolak, Minta Revisi) oleh Admin
 */
export async function PATCH(req: Request) {
  try {
    const caller = await verifyCaller(req);
    if (!caller || !caller.isAdmin) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya Admin yang dapat mengubah status pengajuan.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { requestId, status, alasanPenolakan, approverInfo } = body;

    if (!requestId || !status) {
      return NextResponse.json(
        { error: 'Parameter requestId dan status wajib disertakan.' },
        { status: 400 }
      );
    }

    const reqRef = adminDb.collection('requests').doc(requestId);
    const updateData: any = { 
      status,
      updatedAt: new Date().toISOString() 
    };

    if (alasanPenolakan !== undefined) {
      updateData.alasanPenolakan = alasanPenolakan;
    }

    if (approverInfo) {
      if (approverInfo.approverNama) updateData.approverNama = approverInfo.approverNama;
      if (approverInfo.approverNik) updateData.approverNik = approverInfo.approverNik;
      if (approverInfo.approverEmail) updateData.approverEmail = approverInfo.approverEmail;
      updateData.approvedAt = new Date().toISOString();
    }

    await reqRef.update(updateData);

    return NextResponse.json({
      success: true,
      message: `Status pengajuan berhasil diubah menjadi ${status}.`,
    });
  } catch (error: any) {
    console.error('Error PATCH /api/requests:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal mengubah status pengajuan.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/requests
 * Mengirimkan formulir pengajuan baru
 */
export async function POST(req: Request) {
  try {
    const caller = await verifyCaller(req);
    if (!caller) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Anda harus login untuk mengajukan permohonan.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const requestData = {
      ...body,
      karyawanId: caller.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await adminDb.collection('requests').add(requestData);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      message: 'Pengajuan berhasil dikirim.',
    });
  } catch (error: any) {
    console.error('Error POST /api/requests:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal mengirim pengajuan.' },
      { status: 500 }
    );
  }
}
