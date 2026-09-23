import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyCaller } from '@/lib/auth-server';

// Rumus Haversine untuk menghitung jarak antara 2 titik koordinat (dalam meter)
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Radius bumi dalam meter
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Jam dan Tanggal Server Dinamis (Sesuai Pengaturan Zona Waktu Perusahaan: WIB, WITA, WIT, JST)
async function getCompanyTimezone(): Promise<string> {
  try {
    const snap = await adminDb.collection('settings').doc('company_settings').get();
    if (snap.exists && snap.data()?.timezone) {
      return snap.data()?.timezone;
    }
  } catch (e) {
    console.warn("Gagal membaca timezone dari settings:", e);
  }
  return process.env.APP_TIMEZONE || 'Asia/Tokyo';
}

function getAppDateTime(timeZone: string = 'Asia/Tokyo') {
  const now = new Date();
  
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);

  const day = parseInt(parts.find(p => p.type === 'day')!.value, 10);
  const month = parseInt(parts.find(p => p.type === 'month')!.value, 10);
  const year = parseInt(parts.find(p => p.type === 'year')!.value, 10);

  const formatShort = `${day}/${month}/${year}`;
  const formatPadded = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  const formatIso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const possibleDates = Array.from(new Set([formatShort, formatPadded, formatIso, now.toLocaleDateString('id-ID')]));

  const timeFormatter = new Intl.DateTimeFormat('id-ID', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const timeString = timeFormatter.format(now).replace('.', ':');

  let code = "WIB";
  if (timeZone === "Asia/Tokyo") code = "JST";
  else if (timeZone === "Asia/Jayapura") code = "WIT";
  else if (timeZone === "Asia/Makassar") code = "WITA";

  return { now, tanggal: formatShort, possibleDates, timeString, timezone: timeZone, timezoneCode: code };
}

// POST: Absen Masuk
export async function POST(req: Request) {
  try {
    const caller = await verifyCaller(req);
    if (!caller) {
      return NextResponse.json({ error: 'Akses Ditolak: Anda harus login untuk melakukan absensi.' }, { status: 401 });
    }

    const body = await req.json();
    const { lat, lng } = body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'Koordinat GPS wajib valid.' }, { status: 400 });
    }

    // 1. Ambil data profil karyawan
    const empDoc = await adminDb.collection('employees').doc(caller.uid).get();
    let empData = empDoc.exists ? empDoc.data() : null;

    if (!empData) {
      const empQuery = await adminDb.collection('employees').where('email', '==', caller.email).limit(1).get();
      if (!empQuery.empty) {
        empData = empQuery.docs[0].data();
      }
    }

    if (!empData) {
      return NextResponse.json({ error: 'Data profil karyawan tidak ditemukan di sistem.' }, { status: 404 });
    }

    if (empData.status === 'Nonaktif') {
      return NextResponse.json({ error: 'Akun karyawan berstatus Nonaktif. Tidak dapat melakukan absensi.' }, { status: 403 });
    }

    // 2. Validasi Jarak Geofencing / Radius Kantor
    const locsSnapshot = await adminDb.collection('locations').get();
    const allLocations = locsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

    if (allLocations.length > 0) {
      let eligibleLocations = allLocations;
      if (empData.lokasiId && empData.lokasiId !== 'all') {
        const assigned = allLocations.filter(l => l.id === empData.lokasiId);
        if (assigned.length > 0) {
          eligibleLocations = assigned;
        }
      }

      let minDistance = Infinity;
      let closestLoc = eligibleLocations[0];

      for (const loc of eligibleLocations) {
        if (typeof loc.lat === 'number' && typeof loc.lng === 'number') {
          const dist = calculateDistanceMeters(lat, lng, loc.lat, loc.lng);
          if (dist < minDistance) {
            minDistance = dist;
            closestLoc = loc;
          }
        }
      }

      const allowedRadius = closestLoc.radius || 50;
      if (minDistance > allowedRadius) {
        return NextResponse.json({
          error: `Anda berada di luar radius kantor (${Math.round(minDistance)}m dari ${closestLoc.nama || 'Kantor'}, batas radius ${allowedRadius}m). Absensi masuk ditolak.`
        }, { status: 400 });
      }
    }

    // 3. Waktu Server & Keterlambatan
    const appTimezone = await getCompanyTimezone();
    const { tanggal, possibleDates, timeString, timezoneCode } = getAppDateTime(appTimezone);

    // Cek apakah sudah pernah absen masuk hari ini
    const existingCheck = await adminDb.collection('attendance')
      .where('karyawanId', '==', caller.uid)
      .where('tanggal', 'in', possibleDates)
      .limit(1)
      .get();

    if (!existingCheck.empty) {
      const existingData = existingCheck.docs[0].data();
      return NextResponse.json({
        success: true,
        alreadyCheckedIn: true,
        docId: existingCheck.docs[0].id,
        tanggal,
        timeCheckin: existingData.jamMasuk,
        status: existingData.status,
        message: 'Anda sudah melakukan absen masuk hari ini.'
      });
    }

    const batasMasuk = empData.shiftMasuk || '08:00';
    const isTerlambat = timeString > batasMasuk;

    const newAttendance = {
      karyawanId: caller.uid,
      karyawanNama: empData.nama || caller.nama || 'Karyawan',
      tanggal,
      jamMasuk: timeString,
      jamKeluar: null,
      status: isTerlambat ? 'Terlambat' : 'Hadir',
      koordinatMasuk: { lat, lng },
      createdAt: new Date(),
      verifiedByServer: true,
    };

    const docRef = await adminDb.collection('attendance').add(newAttendance);

    return NextResponse.json({
      success: true,
      docId: docRef.id,
      tanggal,
      timeCheckin: timeString,
      status,
      timezone: appTimezone,
      timezoneCode,
      message: isTerlambat ? `Absen masuk berhasil (Terlambat: ${timeString} ${timezoneCode})` : `Absen masuk berhasil (${timeString} ${timezoneCode})`
    });

  } catch (error: any) {
    console.error('Check-in error:', error);
    return NextResponse.json({ error: error.message || 'Gagal memproses absen masuk.' }, { status: 500 });
  }
}

// PUT: Absen Pulang
export async function PUT(req: Request) {
  try {
    const caller = await verifyCaller(req);
    if (!caller) {
      return NextResponse.json({ error: 'Akses Ditolak: Anda harus login untuk melakukan absensi.' }, { status: 401 });
    }

    const body = await req.json();
    const { lat, lng, docId } = body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'Koordinat GPS wajib valid.' }, { status: 400 });
    }

    const empDoc = await adminDb.collection('employees').doc(caller.uid).get();
    const empData = empDoc.exists ? empDoc.data() : null;

    const appTimezone = await getCompanyTimezone();
    const { tanggal, possibleDates, timeString, timezoneCode } = getAppDateTime(appTimezone);

    // 1. Cek Batas Jam Pulang
    const batasKeluar = empData?.shiftKeluar || '17:00';
    if (timeString < batasKeluar) {
      return NextResponse.json({
        error: `Belum masuk waktu pulang (Jadwal pulang shift Anda: ${batasKeluar}, jam server saat ini: ${timeString} ${timezoneCode}).`
      }, { status: 400 });
    }

    // 2. Cari dokumen absensi hari ini
    let targetDocId = docId;
    if (!targetDocId) {
      const snap = await adminDb.collection('attendance')
        .where('karyawanId', '==', caller.uid)
        .where('tanggal', 'in', possibleDates)
        .limit(1)
        .get();
      if (!snap.empty) {
        targetDocId = snap.docs[0].id;
      }
    }

    if (!targetDocId) {
      return NextResponse.json({ error: 'Data absen masuk hari ini tidak ditemukan.' }, { status: 404 });
    }

    // 3. Update Jam Pulang
    await adminDb.collection('attendance').doc(targetDocId).update({
      jamKeluar: timeString,
      koordinatKeluar: { lat, lng },
      updatedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      docId: targetDocId,
      tanggal,
      timeCheckout: timeString,
      timezone: appTimezone,
      timezoneCode,
      message: `Berhasil absen pulang pada pukul ${timeString} ${timezoneCode}`
    });

  } catch (error: any) {
    console.error('Check-out error:', error);
    return NextResponse.json({ error: error.message || 'Gagal memproses absen pulang.' }, { status: 500 });
  }
}

/**
 * DELETE /api/attendance
 * Menghapus satu atau seluruh riwayat absensi (Khusus Super Admin untuk all=true)
 */
export async function DELETE(req: Request) {
  try {
    const caller = await verifyCaller(req);
    if (!caller || !caller.isAdmin) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Hanya Admin / Super Admin yang berhak menghapus riwayat absensi.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const docId = searchParams.get('id');
    const deleteAll = searchParams.get('all') === 'true';

    // 1. Hapus Semua Riwayat Absensi (Khusus Super Admin)
    if (deleteAll) {
      if (!caller.isSuperAdmin) {
        return NextResponse.json(
          { error: 'Akses Ditolak: Hanya Super Admin yang berhak menghapus seluruh riwayat absensi.' },
          { status: 403 }
        );
      }

      const snapshot = await adminDb.collection('attendance').get();
      const batch = adminDb.batch();
      let count = 0;

      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
        count++;
      });

      if (count > 0) {
        await batch.commit();
      }

      // Catat log audit
      await adminDb.collection('admin_logs').add({
        adminEmail: caller.email,
        adminName: caller.nama || 'Super Admin',
        action: 'HAPUS_SEMUA_RIWAYAT_ABSENSI',
        target: 'Semua Riwayat Absensi',
        details: `Menghapus seluruh ${count} data riwayat kehadiran karyawan`,
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        deletedCount: count,
        message: `Berhasil menghapus ${count} riwayat absensi.`,
      });
    }

    // 2. Hapus Satu Data Absensi
    if (!docId) {
      return NextResponse.json(
        { error: 'Parameter id absensi atau all=true wajib disertakan.' },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection('attendance').doc(docId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return NextResponse.json(
        { error: 'Data absensi tidak ditemukan.' },
        { status: 404 }
      );
    }

    const attData = docSnap.data();
    await docRef.delete();

    // Catat log audit
    await adminDb.collection('admin_logs').add({
      adminEmail: caller.email,
      adminName: caller.nama || 'Admin',
      action: 'HAPUS_RIWAYAT_ABSENSI',
      target: attData?.karyawanNama || docId,
      details: `Menghapus data absensi tanggal ${attData?.tanggal || '-'} untuk ${attData?.karyawanNama || docId}`,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Data riwayat absensi berhasil dihapus.',
    });
  } catch (error: any) {
    console.error('Error DELETE /api/attendance:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal menghapus riwayat absensi.' },
      { status: 500 }
    );
  }
}
