import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyCaller } from '@/lib/auth-server';

const DEFAULT_SETTINGS = {
  timezone: 'Asia/Tokyo',
  timezoneCode: 'JST',
  timezoneLabel: 'JST - Jepang (UTC+9)',
};

/**
 * GET /api/settings
 * Mengambil pengaturan global perusahaan (zona waktu dll)
 */
export async function GET() {
  try {
    const snap = await adminDb.collection('settings').doc('company_settings').get();
    if (snap.exists) {
      return NextResponse.json({
        success: true,
        settings: { ...DEFAULT_SETTINGS, ...snap.data() }
      });
    }
    return NextResponse.json({
      success: true,
      settings: DEFAULT_SETTINGS
    });
  } catch (error: any) {
    console.error('Error GET /api/settings:', error);
    return NextResponse.json({
      success: true,
      settings: DEFAULT_SETTINGS
    });
  }
}

/**
 * PUT /api/settings
 * Memperbarui pengaturan global perusahaan (Hanya Admin / Super Admin)
 */
export async function PUT(req: Request) {
  try {
    const caller = await verifyCaller(req);
    if (!caller || !caller.isAdmin) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya Admin yang dapat mengubah pengaturan perusahaan.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { timezone, timezoneCode, timezoneLabel } = body;

    if (!timezone) {
      return NextResponse.json(
        { error: 'Zona waktu (timezone) wajib disertakan.' },
        { status: 400 }
      );
    }

    const updateData: any = {
      timezone,
      timezoneCode: timezoneCode || (
        timezone === 'Asia/Jakarta' ? 'WIB' :
        timezone === 'Asia/Makassar' ? 'WITA' :
        timezone === 'Asia/Jayapura' ? 'WIT' :
        timezone === 'Asia/Tokyo' ? 'JST' : 'WIB'
      ),
      timezoneLabel: timezoneLabel || timezone,
      updatedAt: new Date().toISOString(),
      updatedBy: caller.nama || caller.email,
      updatedByEmail: caller.email
    };

    await adminDb.collection('settings').doc('company_settings').set(updateData, { merge: true });

    // Catat log aktivitas admin
    await adminDb.collection('admin_logs').add({
      adminEmail: caller.email,
      adminName: caller.nama || 'Admin',
      action: 'UPDATE_ZONA_WAKTU',
      target: updateData.timezoneCode,
      details: `Mengubah zona waktu operasional sistem ke ${updateData.timezoneLabel} (${updateData.timezone})`,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Zona waktu operasional berhasil diubah ke ${updateData.timezoneCode}.`,
      settings: updateData
    });
  } catch (error: any) {
    console.error('Error PUT /api/settings:', error);
    return NextResponse.json(
      { error: 'Gagal menyimpan pengaturan zona waktu.' },
      { status: 500 }
    );
  }
}
