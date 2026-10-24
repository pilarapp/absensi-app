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
  return process.env.APP_TIMEZONE || 'Asia/Jakarta';
}

function parseDateParts(dateStr: string): { y: number; m: number; d: number } | null {
  if (!dateStr) return null;
  const str = String(dateStr).split('T')[0].trim();
  const delimiter = str.includes('/') ? '/' : '-';
  const parts = str.split(delimiter).map((p: string) => parseInt(p, 10)).filter((n: number) => !isNaN(n));
  if (parts.length === 3) {
    if (parts[0] > 1900) {
      return { y: parts[0], m: parts[1], d: parts[2] };
    } else if (parts[2] > 1900) {
      return { d: parts[0], m: parts[1], y: parts[2] };
    }
  }
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) {
    return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
  }
  return null;
}

function compareDates(dateStr1: string, dateStr2: string): number {
  const p1 = parseDateParts(dateStr1);
  const p2 = parseDateParts(dateStr2);
  if (!p1 || !p2) return 0;
  const t1 = new Date(p1.y, p1.m - 1, p1.d).getTime();
  const t2 = new Date(p2.y, p2.m - 1, p2.d).getTime();
  return Math.round((t1 - t2) / (1000 * 60 * 60 * 24));
}

function getAppDateTime(timeZone: string = 'Asia/Jakarta') {
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
  
  let localizedId = '';
  try {
    localizedId = now.toLocaleDateString('id-ID', { timeZone });
  } catch {
    localizedId = formatShort;
  }
  
  const possibleDates = Array.from(new Set([formatShort, formatPadded, formatIso, localizedId]));

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
  else if (timeZone === "Asia/Jakarta") code = "WIB";

  return { now, tanggal: formatShort, possibleDates, timeString, timezone: timeZone, timezoneCode: code, day, month, year };
}

// POST: Absen Masuk
export async function POST(req: Request) {
  try {
    const caller = await verifyCaller(req);
    if (!caller) {
      return NextResponse.json({ error: 'Akses Ditolak: Anda harus login untuk melakukan absensi.' }, { status: 401 });
    }

    const body = await req.json();
    const { lat, lng, shiftName, shiftMasuk, shiftKeluar } = body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'Koordinat GPS wajib valid.' }, { status: 400 });
    }

    // 1. Ambil data profil karyawan, lokasi, dan timezone secara paralel
    const [empDoc, locsSnapshot, appTimezone] = await Promise.all([
      adminDb.collection('employees').doc(caller.uid).get().catch(() => null),
      adminDb.collection('locations').get().catch(() => null),
      getCompanyTimezone().catch(() => 'Asia/Jakarta'),
    ]);

    let empData = empDoc?.exists ? empDoc.data() : null;

    if (!empData && caller.email) {
      const empQuery = await adminDb.collection('employees').where('email', '==', caller.email).limit(1).get().catch(() => null);
      if (empQuery && !empQuery.empty) {
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
    const allLocations = locsSnapshot?.docs ? (locsSnapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })) as any[]) : [];

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
    const { tanggal, possibleDates, timeString, timezoneCode } = getAppDateTime(appTimezone);

    // 4. Periksa sesi absensi karyawan
    const recentAttQuery = await adminDb.collection('attendance')
      .where('karyawanId', '==', caller.uid)
      .limit(10)
      .get()
      .catch(() => null);

    const recentDocs: any[] = recentAttQuery?.docs ? (recentAttQuery.docs.map(d => ({ id: d.id, ...d.data() })) as any[]) : [];
    // Urutkan dari yang terbaru
    recentDocs.sort((a: any, b: any) => {
      const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return tB - tA;
    });

    const nowTime = Date.now();

    // 4a. Cek apakah ada sesi aktif HARI INI yang belum absen pulang
    const todayUnclosed: any = recentDocs.find((d: any) => {
      if (d.jamKeluar && d.jamKeluar !== '--:--') return false;
      return compareDates(tanggal, d.tanggal) === 0 || possibleDates.includes(d.tanggal);
    });

    if (todayUnclosed) {
      return NextResponse.json({
        success: true,
        alreadyCheckedIn: true,
        docId: todayUnclosed.id,
        tanggal: todayUnclosed.tanggal,
        timeCheckin: todayUnclosed.jamMasuk,
        status: todayUnclosed.status,
        message: 'Anda masih memiliki sesi absensi aktif hari ini yang belum absen pulang.'
      });
    }

    // 4b. Cek apakah ada sesi aktif Shift Malam lintas hari dari kemarin (dalam kurun waktu <= 16 jam, atau <= 26 jam untuk shift 24 jam)
    const overnightActive: any = recentDocs.find((d: any) => {
      if (d.jamKeluar && d.jamKeluar !== '--:--') return false;
      const dateDiff = compareDates(tanggal, d.tanggal);
      if (dateDiff !== 1) return false; // Hanya jika tepat kemarin
      const createdTime = d.createdAt?.toDate ? d.createdAt.toDate().getTime() : new Date(d.createdAt || 0).getTime();
      const ageHours = (nowTime - createdTime) / (1000 * 60 * 60);
      const isCrossDay = (d.shiftKeluar && d.shiftMasuk && d.shiftKeluar <= d.shiftMasuk) || (d.jamMasuk && d.jamMasuk >= '17:00');
      const maxHours = (d.shiftKeluar && d.shiftMasuk && d.shiftKeluar === d.shiftMasuk) ? 26 : 16;
      return isCrossDay && ageHours >= 0 && ageHours <= maxHours;
    });

    if (overnightActive) {
      return NextResponse.json({
        success: true,
        alreadyCheckedIn: true,
        docId: overnightActive.id,
        tanggal: overnightActive.tanggal,
        timeCheckin: overnightActive.jamMasuk,
        status: overnightActive.status,
        message: 'Anda masih berada dalam sesi dinas Shift Malam yang belum absen pulang.'
      });
    }

    // 5. Jika karyawan adalah Fix Time (bukan shift/satpam), batasi 1 kali absensi per hari kalender
    const isShiftWorker = empData?.tipeKerja === 'Shift' || 
      (empData?.posisi && empData.posisi.toLowerCase().includes('satpam')) || 
      !!shiftName;

    if (!isShiftWorker) {
      const existingToday: any = recentDocs.find((d: any) => 
        compareDates(tanggal, d.tanggal) === 0 || possibleDates.includes(d.tanggal)
      );
      if (existingToday) {
        return NextResponse.json({
          success: true,
          alreadyCheckedIn: true,
          docId: existingToday.id,
          tanggal: existingToday.tanggal,
          timeCheckin: existingToday.jamMasuk,
          status: existingToday.status,
          message: 'Anda sudah melakukan absensi hari ini.'
        });
      }
    }

    const batasMasuk = shiftMasuk || empData.shiftMasuk || '08:00';
    const isTerlambat = timeString > batasMasuk;
    const attendanceStatus = isTerlambat ? 'Terlambat' : 'Hadir';

    const newAttendance: any = {
      karyawanId: caller.uid,
      karyawanNama: empData.nama || caller.nama || 'Karyawan',
      tanggal,
      jamMasuk: timeString,
      jamKeluar: null,
      status: attendanceStatus,
      koordinatMasuk: { lat, lng },
      createdAt: new Date(),
      verifiedByServer: true,
    };
    
    // Simpan shift jika ada (untuk shift dinamis/satpam)
    if (shiftName && shiftMasuk && shiftKeluar) {
      newAttendance.shiftName = shiftName;
      newAttendance.shiftMasuk = shiftMasuk;
      newAttendance.shiftKeluar = shiftKeluar;
    }

    const docRef = await adminDb.collection('attendance').add(newAttendance);

    return NextResponse.json({
      success: true,
      docId: docRef.id,
      tanggal,
      timeCheckin: timeString,
      status: attendanceStatus,
      timezone: appTimezone,
      timezoneCode,
      message: isTerlambat ? `Absen masuk berhasil (Terlambat: ${timeString} ${timezoneCode})` : `Absen masuk berhasil (${timeString} ${timezoneCode})`
    });

  } catch (error: any) {
    console.error('Check-in error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server saat memproses absen masuk. Silakan coba beberapa saat lagi.' }, { status: 500 });
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

    const [empDoc, appTimezone] = await Promise.all([
      adminDb.collection('employees').doc(caller.uid).get().catch(() => null),
      getCompanyTimezone().catch(() => 'Asia/Jakarta'),
    ]);

    const empData = empDoc?.exists ? empDoc.data() : null;
    const { tanggal, possibleDates, timeString, timezoneCode } = getAppDateTime(appTimezone);

    // Cari dokumen absensi yang ditargetkan untuk checkout
    let targetDocId = docId;
    let attendanceData: any = null;

    if (targetDocId) {
      const snap = await adminDb.collection('attendance').doc(targetDocId).get();
      if (snap.exists) attendanceData = snap.data();
    }

    // Jika tidak ditemukan via docId atau docId tidak dikirim (misal setelah refresh / pergantian hari):
    // Cari dokumen absensi aktif yang belum checkout (jamKeluar == null) dalam kurun waktu 30 jam
    if (!targetDocId || !attendanceData) {
      const recentSnap = await adminDb.collection('attendance')
        .where('karyawanId', '==', caller.uid)
        .limit(10)
        .get()
        .catch(() => null);

      if (recentSnap && !recentSnap.empty) {
        const recentDocs = recentSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        recentDocs.sort((a: any, b: any) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
          const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
          return tB - tA;
        });

        // 1. Cari yang belum checkout hari ini
        const unclosedToday = recentDocs.find((d: any) => 
          (!d.jamKeluar || d.jamKeluar === '--:--') && (compareDates(tanggal, d.tanggal) === 0 || possibleDates.includes(d.tanggal))
        );

        // 2. Atau cari sesi unclosed Shift Malam lintas hari dari kemarin
        const unclosedOvernight = recentDocs.find((d: any) => {
          if (d.jamKeluar && d.jamKeluar !== '--:--') return false;
          const createdTime = d.createdAt?.toDate ? d.createdAt.toDate().getTime() : new Date(d.createdAt || 0).getTime();
          const ageHours = (Date.now() - createdTime) / (1000 * 60 * 60);
          const isCrossDay = (d.shiftKeluar && d.shiftMasuk && d.shiftKeluar <= d.shiftMasuk) || (d.jamMasuk && d.jamMasuk >= '17:00');
          const maxHours = (d.shiftKeluar && d.shiftMasuk && d.shiftKeluar === d.shiftMasuk) ? 26 : 16;
          return isCrossDay && ageHours >= 0 && ageHours <= maxHours;
        });

        const unclosed = unclosedToday || unclosedOvernight;
        if (unclosed) {
          targetDocId = unclosed.id;
          attendanceData = unclosed;
        } else {
          // 3. Cari yang tanggalnya hari ini
          const todayDoc = recentDocs.find((d: any) => compareDates(tanggal, d.tanggal) === 0 || possibleDates.includes(d.tanggal));
          if (todayDoc) {
            targetDocId = todayDoc.id;
            attendanceData = todayDoc;
          }
        }
      }
    }

    if (!targetDocId || !attendanceData) {
      return NextResponse.json({ error: 'Data sesi absensi masuk tidak ditemukan.' }, { status: 404 });
    }

    // 1. Cek Durasi Sejak Check-In (mencegah klik ganda tidak sengaja dalam 2 menit pertama)
    const checkinCreated = attendanceData.createdAt?.toDate 
      ? attendanceData.createdAt.toDate().getTime() 
      : new Date(attendanceData.createdAt || 0).getTime();
    const elapsedMinutes = (Date.now() - checkinCreated) / (1000 * 60);

    if (elapsedMinutes < 2 && compareDates(tanggal, attendanceData.tanggal) === 0) {
      return NextResponse.json({
        error: 'Anda baru saja melakukan absen masuk kurang dari 2 menit yang lalu. Harap tunggu sebentar sebelum absen pulang.'
      }, { status: 400 });
    }

    // 2. Evaluasi Jadwal & Status Pulang Lebih Awal (Piket / Shift Pagi / Pulang Cepat)
    const shiftKeluarTime = attendanceData.shiftKeluar || empData?.shiftKeluar || '17:00';
    const shiftMasukTime = attendanceData.shiftMasuk || empData?.shiftMasuk || '08:00';
    const checkinTime = attendanceData.jamMasuk || shiftMasukTime;
    
    // Apakah shift melewati tengah malam? (misal 20:00 - 08:00)
    const isCrossDayShift = shiftKeluarTime <= shiftMasukTime;
    const is24HourShift = shiftKeluarTime === shiftMasukTime;
    const dateDiff = compareDates(tanggal, attendanceData.tanggal);

    let isPulangAwal = false;

    if (isCrossDayShift) {
      if (is24HourShift) {
        if (dateDiff === 0 || (dateDiff === 1 && timeString < shiftKeluarTime)) {
          isPulangAwal = true;
        }
      } else if (checkinTime >= "12:00") {
        if (dateDiff === 0 || (dateDiff === 1 && timeString < shiftKeluarTime)) {
          isPulangAwal = true;
        }
      } else {
        if (dateDiff === 0 && timeString < shiftKeluarTime) {
          isPulangAwal = true;
        }
      }
    } else {
      // Shift normal / Piket / Fix Time pada hari yang sama
      if (dateDiff === 0 && timeString < shiftKeluarTime) {
        isPulangAwal = true;
      }
    }

    // Tentukan status kehadiran akhir secara fleksibel
    let finalStatus = attendanceData.status || 'Hadir';
    if (isPulangAwal) {
      if (finalStatus === 'Terlambat') {
        finalStatus = 'Terlambat & Pulang Cepat';
      } else if (finalStatus === 'Hadir') {
        finalStatus = 'Pulang Cepat';
      }
    }

    // 3. Update Jam Pulang ke Firestore (Selalu izinkan checkout agar karyawan piket/shift pagi tidak terblokir)
    const updatePayload: any = {
      jamKeluar: timeString,
      koordinatKeluar: { lat, lng },
      status: finalStatus,
      isPulangAwal,
      updatedAt: new Date()
    };

    await adminDb.collection('attendance').doc(targetDocId).update(updatePayload);

    const messageText = isPulangAwal
      ? `Berhasil absen pulang pada pukul ${timeString} ${timezoneCode} (Selesai dinas / Pulang lebih awal).`
      : `Berhasil absen pulang pada pukul ${timeString} ${timezoneCode}.`;

    return NextResponse.json({
      success: true,
      docId: targetDocId,
      tanggal,
      timeCheckout: timeString,
      status: finalStatus,
      isPulangAwal,
      timezone: appTimezone,
      timezoneCode,
      message: messageText
    });

  } catch (error: any) {
    console.error('Check-out error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server saat memproses absen pulang. Silakan coba beberapa saat lagi.' }, { status: 500 });
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
      { error: 'Terjadi kesalahan pada server saat menghapus riwayat absensi.' },
      { status: 500 }
    );
  }
}
