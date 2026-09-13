import { collection, addDoc, updateDoc, doc, onSnapshot, query, getDocs, where, serverTimestamp, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// === KOLEKSI NAMA ===
const COLL_LOCATIONS = "locations";
const COLL_EMPLOYEES = "employees";
const COLL_ATTENDANCE = "attendance";
const COLL_REQUESTS = "requests";
const COLL_FINANCES = "finances";
const COLL_SALARY = "salary_slips";
const COLL_NOTIFICATIONS = "notifications";
const COLL_AUDIT_LOGS = "audit_logs";
const COLL_ADMINS = "admins";
const COLL_POSITIONS = "positions";

// Fungsi abstraksi dasar (Data Access Layer) yang akan digunakan nanti.
// Catatan: Jika db belum diinisialisasi (keys kosong), fungsi akan melempar error ringan atau mengembalikan null.

export const fetchLocations = async () => {
  if (!db) return [];
  const snapshot = await getDocs(collection(db, COLL_LOCATIONS));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const subscribeToLocations = (callback: (data: any[]) => void) => {
  if (!db) return () => {};
  const q = query(collection(db, COLL_LOCATIONS));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  });
};

export const addLocation = async (locationData: any) => {
  if (!db) return false;
  try {
    await addDoc(collection(db, COLL_LOCATIONS), {
      ...locationData,
      createdAt: serverTimestamp()
    });
    return true;
  } catch (err) {
    console.error("Gagal menambahkan lokasi ke Firebase:", err);
    return false;
  }
};

export const updateLocation = async (locationId: string, updateData: any) => {
  if (!db) return false;
  try {
    const locRef = doc(db, COLL_LOCATIONS, locationId);
    await updateDoc(locRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (err) {
    console.error("Gagal memperbarui lokasi:", err);
    return false;
  }
};

export const deleteLocation = async (locationId: string) => {
  if (!db) return false;
  try {
    const { deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(db, COLL_LOCATIONS, locationId));
    return true;
  } catch (err) {
    console.error("Gagal menghapus lokasi:", err);
    return false;
  }
};

export const fetchEmployees = async () => {
  if (!db) return [];
  const snapshot = await getDocs(collection(db, COLL_EMPLOYEES));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const subscribeToEmployees = (callback: (data: any[]) => void) => {
  if (!db) return () => {};
  const q = query(collection(db, COLL_EMPLOYEES));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  });
};

export const getTodayAttendance = async (karyawanId: string) => {
  if (!db) return null;
  try {
    const today = new Date().toLocaleDateString("id-ID");
    const q = query(
      collection(db, COLL_ATTENDANCE), 
      where("karyawanId", "==", karyawanId),
      where("tanggal", "==", today)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
    }
    return null;
  } catch (err) {
    console.error("Gagal mengambil absensi hari ini:", err);
    return null;
  }
};

export const recordCheckIn = async (data: any) => {
  if (!db) return null;
  try {
    const docRef = await addDoc(collection(db, COLL_ATTENDANCE), {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (err) {
    console.error("Gagal merekam absen masuk ke Firebase:", err);
    return null;
  }
};

export const recordCheckOut = async (docId: string, timeCheckout: string, koordinatKeluar: any) => {
  if (!db) return false;
  try {
    await updateDoc(doc(db, COLL_ATTENDANCE, docId), {
      jamKeluar: timeCheckout,
      koordinatKeluar: koordinatKeluar,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (err) {
    console.error("Gagal merekam absen pulang ke Firebase:", err);
    return false;
  }
};

export const deleteAttendance = async (docId: string) => {
  if (!db) return false;
  try {
    const { deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(db, COLL_ATTENDANCE, docId));
    return true;
  } catch (err) {
    console.error("Gagal menghapus absen masuk dari Firebase:", err);
    return false;
  }
};

export const getEmployee = async (uid: string) => {
  if (!db) return null;
  try {
    const docSnap = await getDoc(doc(db, "employees", uid));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as any;
    }
    return null;
  } catch (err) {
    console.error("Gagal fetch employee:", err);
    return null;
  }
};

export const updateEmployeeProfile = async (uid: string, data: any) => {
  if (!db) return false;
  try {
    await setDoc(doc(db, "employees", uid), {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error("Gagal update profil karyawan:", err);
    return false;
  }
};

export const paySalary = async (salaryData: any, transactionData: any, notificationData: any) => {
  if (!db) return false;
  try {
    // 1. Simpan slip gaji
    await addDoc(collection(db, COLL_SALARY), {
      ...salaryData,
      createdAt: serverTimestamp()
    });
    // 2. Simpan transaksi keuangan
    await addDoc(collection(db, COLL_FINANCES), {
      ...transactionData,
      createdAt: serverTimestamp()
    });
    // 3. Kirim notifikasi realtime
    await addDoc(collection(db, COLL_NOTIFICATIONS), {
      ...notificationData,
      createdAt: serverTimestamp()
    });
    return true;
  } catch (err) {
    console.error("Gagal memproses gaji via Firebase:", err);
    return false;
  }
};

// === PENGAJUAN CUTI (REQUESTS) ===
export const submitRequest = async (requestData: any) => {
  if (!db) return false;
  try {
    const docRef = await addDoc(collection(db, COLL_REQUESTS), {
      ...requestData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (err) {
    console.error("Gagal mengirim pengajuan ke Firebase:", err);
    return null;
  }
};

export const updateRequestStatus = async (requestId: string, status: string, alasanPenolakan: string = "") => {
  if (!db) return false;
  try {
    const reqRef = doc(db, COLL_REQUESTS, requestId);
    const updateData: any = { status };
    if (alasanPenolakan) {
      updateData.alasanPenolakan = alasanPenolakan;
    }
    await updateDoc(reqRef, updateData);
    return true;
  } catch (err) {
    console.error("Gagal memperbarui status pengajuan:", err);
    return false;
  }
};

export const updateRequest = async (requestId: string, updateData: any) => {
  if (!db) return false;
  try {
    const reqRef = doc(db, COLL_REQUESTS, requestId);
    await updateDoc(reqRef, updateData);
    return true;
  } catch (err) {
    console.error("Gagal memperbarui pengajuan:", err);
    return false;
  }
};

// Normalisasi Firestore data (terutama untuk Timestamp)
const normalizeData = (docData: any) => {
  const data = { ...docData };
  if (data.createdAt) {
    if (typeof data.createdAt.toDate === 'function') {
      data.createdAt = data.createdAt.toDate().toISOString();
    } else if (data.createdAt.seconds) {
      data.createdAt = new Date(data.createdAt.seconds * 1000).toISOString();
    }
  } else {
    data.createdAt = new Date().toISOString(); // fallback
  }
  return data;
};

// Mengambil semua pengajuan
export const fetchRequests = async () => {
  if (!db) return [];
  const snapshot = await getDocs(collection(db, COLL_REQUESTS));
  return snapshot.docs.map(doc => ({ id: doc.id, ...normalizeData(doc.data()) }));
};

// Mengambil satu pengajuan berdasarkan ID
export const fetchRequestById = async (requestId: string) => {
  if (!db) return null;
  const docRef = doc(db, COLL_REQUESTS, requestId);
  const snapshot = await getDocs(query(collection(db, COLL_REQUESTS), where("__name__", "==", requestId)));
  if (!snapshot.empty) {
    return { id: snapshot.docs[0].id, ...normalizeData(snapshot.docs[0].data()) };
  }
  return null;
};

// Subscribe ke perubahan realtime (digunakan oleh Admin)
export const subscribeToRequests = (callback: (data: any[]) => void) => {
  if (!db) return () => {};
  const q = query(collection(db, COLL_REQUESTS));
  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...normalizeData(doc.data())
    }));
    callback(requests);
  });
};

export const subscribeToAllAttendance = (callback: (data: any[]) => void) => {
  if (!db) return () => {};
  const q = query(collection(db, COLL_ATTENDANCE));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...normalizeData(doc.data())
    }));
    callback(data);
  });
};

export const subscribeToFinances = (callback: (data: any[]) => void) => {
  if (!db) return () => {};
  const q = query(collection(db, COLL_FINANCES));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...normalizeData(doc.data())
    }));
    callback(data);
  });
};

export const addFinanceTransaction = async (data: any) => {
  if (!db) return null;
  try {
    const docRef = await addDoc(collection(db, COLL_FINANCES), {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (err) {
    console.error("Gagal menambah transaksi keuangan:", err);
    return null;
  }
};

export const deleteFinanceTransaction = async (id: string) => {
  if (!db) return false;
  try {
    const { deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(db, COLL_FINANCES, id));
    return true;
  } catch (err) {
    console.error("Gagal menghapus transaksi keuangan:", err);
    return false;
  }
};

export const subscribeToSalaries = (karyawanId: string | null, callback: (data: any[]) => void) => {
  if (!db) return () => {};
  let q = query(collection(db, COLL_SALARY));
  if (karyawanId) {
    q = query(collection(db, COLL_SALARY), where("karyawanId", "==", karyawanId));
  }
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...normalizeData(doc.data())
    }));
    callback(data);
  });
};

export const subscribeToNotifications = (userId: string, callback: (data: any[]) => void) => {
  if (!db) return () => {};
  const q = query(collection(db, COLL_NOTIFICATIONS), where("userId", "==", userId));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...normalizeData(doc.data())
    }));
    callback(data);
  });
};

export const addNotification = async (userId: string, title: string, message: string, type: string) => {
  if (!db) return null;
  try {
    const docRef = await addDoc(collection(db, COLL_NOTIFICATIONS), {
      userId,
      title,
      message,
      type,
      isRead: false,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (err) {
    console.error("Gagal menambah notifikasi:", err);
    return null;
  }
};

export const markNotificationRead = async (id: string) => {
  if (!db) return false;
  try {
    await updateDoc(doc(db, COLL_NOTIFICATIONS, id), {
      isRead: true,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (err) {
    console.error("Gagal update notifikasi:", err);
    return false;
  }
};

export const getEmployeeAttendance = async (karyawanId: string) => {
  if (!db) return [];
  try {
    const q = query(
      collection(db, COLL_ATTENDANCE),
      where("karyawanId", "==", karyawanId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...normalizeData(doc.data()) }));
  } catch (err) {
    console.error("Gagal mengambil absensi karyawan:", err);
    return [];
  }
};

export const getEmployeeRequests = async (karyawanId: string) => {
  if (!db) return [];
  try {
    const q = query(
      collection(db, COLL_REQUESTS),
      where("karyawanId", "==", karyawanId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...normalizeData(doc.data()) }));
  } catch (err) {
    console.error("Gagal mengambil pengajuan karyawan:", err);
    return [];
  }
};

// === AUDIT LOG SYSTEM ===
export const logAdminActivity = async ({
  adminEmail,
  adminName = "Administrator",
  action,
  target = "-",
  details = "-",
}: {
  adminEmail: string;
  adminName?: string;
  action: string;
  target?: string;
  details?: string;
}) => {
  if (!db) return null;
  try {
    const docRef = await addDoc(collection(db, COLL_AUDIT_LOGS), {
      adminEmail,
      adminName,
      action,
      target,
      details,
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
    });
    return docRef.id;
  } catch (err) {
    console.error("Gagal mencatat audit log:", err);
    return null;
  }
};

export const subscribeToAuditLogs = (callback: (logs: any[]) => void) => {
  if (!db) return () => {};
  const q = query(collection(db, COLL_AUDIT_LOGS));
  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map(doc => {
      const data = doc.data();
      let ts = data.createdAt || new Date().toISOString();
      if (data.timestamp && typeof data.timestamp.toDate === 'function') {
        ts = data.timestamp.toDate().toISOString();
      }
      return {
        id: doc.id,
        ...data,
        timestampIso: ts,
      };
    });
    // Urutkan dari yang terbaru ke terlama
    logs.sort((a, b) => new Date(b.timestampIso).getTime() - new Date(a.timestampIso).getTime());
    callback(logs);
  });
};

export const checkIsAdmin = async (uid: string): Promise<boolean> => {
  if (!db || !uid) return false;
  try {
    const adminDoc = await getDoc(doc(db, COLL_ADMINS, uid));
    return adminDoc.exists();
  } catch (err) {
    console.error("Gagal cek admin:", err);
    return false;
  }
};

// === MASTER DATA POSISI / JABATAN ===
export const DEFAULT_POSITIONS: string[] = [
  "Pengawas",
  "Pramubakti",
  "Tenaga Kebersihan",
  "Pengemudi",
  "Petugas PTSP",
  "Satpam"
];

export interface PositionItem {
  id: string;
  nama: string;
  isDefault?: boolean;
  createdAt?: any;
}

export const fetchPositions = async (): Promise<PositionItem[]> => {
  if (!db) {
    return DEFAULT_POSITIONS.map((p, idx) => ({ id: `default-${idx}`, nama: p, isDefault: true }));
  }
  const firestore = db;
  try {
    const snapshot = await getDocs(collection(firestore, COLL_POSITIONS));
    if (snapshot.empty) {
      for (const pos of DEFAULT_POSITIONS) {
        await addDoc(collection(firestore, COLL_POSITIONS), {
          nama: pos,
          isDefault: true,
          createdAt: serverTimestamp()
        });
      }
      return DEFAULT_POSITIONS.map((p, idx) => ({ id: `default-${idx}`, nama: p, isDefault: true }));
    }
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PositionItem));
  } catch (err) {
    console.error("Gagal mengambil posisi:", err);
    return DEFAULT_POSITIONS.map((p, idx) => ({ id: `default-${idx}`, nama: p, isDefault: true }));
  }
};

export const subscribeToPositions = (callback: (data: PositionItem[]) => void) => {
  if (!db) {
    callback(DEFAULT_POSITIONS.map((p, idx) => ({ id: `default-${idx}`, nama: p, isDefault: true })));
    return () => {};
  }
  const firestore = db;
  const q = query(collection(firestore, COLL_POSITIONS));
  let seeded = false;
  return onSnapshot(q, async (snapshot) => {
    if (snapshot.empty && !seeded) {
      seeded = true;
      try {
        for (const pos of DEFAULT_POSITIONS) {
          await addDoc(collection(firestore, COLL_POSITIONS), {
            nama: pos,
            isDefault: true,
            createdAt: serverTimestamp()
          });
        }
      } catch (err) {
        console.error("Gagal seed default positions:", err);
      }
      callback(DEFAULT_POSITIONS.map((p, idx) => ({ id: `default-${idx}`, nama: p, isDefault: true })));
      return;
    }

    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PositionItem));
    
    // Pastikan seluruh default positions tetap ada dalam daftar meskipun database belum memuat semuanya
    const existingNames = new Set(data.map(d => (d.nama || "").trim().toLowerCase()));
    const missingDefaults = DEFAULT_POSITIONS
      .filter(def => !existingNames.has(def.toLowerCase()))
      .map((def, idx) => ({
        id: `default-${idx}`,
        nama: def,
        isDefault: true
      }));

    const combined = [...missingDefaults, ...data];
    // Urutkan default positions terlebih dahulu sesuai urutan gambar, lalu posisi kustom secara abjad
    combined.sort((a, b) => {
      const idxA = DEFAULT_POSITIONS.indexOf(a.nama);
      const idxB = DEFAULT_POSITIONS.indexOf(b.nama);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.nama.localeCompare(b.nama);
    });

    callback(combined);
  }, (err) => {
    console.error("Error subscribing to positions:", err);
    callback(DEFAULT_POSITIONS.map((p, idx) => ({ id: `default-${idx}`, nama: p, isDefault: true })));
  });
};

export const addPosition = async (nama: string): Promise<{ success: boolean; id?: string; error?: string }> => {
  if (!db) return { success: false, error: "Database tidak terhubung" };
  const firestore = db;
  const trimmed = nama.trim();
  if (!trimmed) return { success: false, error: "Nama posisi / jabatan tidak boleh kosong" };

  try {
    const snapshot = await getDocs(collection(firestore, COLL_POSITIONS));
    const existsInDb = snapshot.docs.some(doc => (doc.data().nama || "").trim().toLowerCase() === trimmed.toLowerCase());
    const existsInDefault = DEFAULT_POSITIONS.some(p => p.trim().toLowerCase() === trimmed.toLowerCase());

    if (existsInDb || existsInDefault) {
      return { success: false, error: `Posisi "${trimmed}" sudah ada dalam daftar` };
    }

    const docRef = await addDoc(collection(firestore, COLL_POSITIONS), {
      nama: trimmed,
      isDefault: false,
      createdAt: serverTimestamp()
    });
    return { success: true, id: docRef.id };
  } catch (err: any) {
    console.error("Gagal menambahkan posisi:", err);
    return { success: false, error: err.message || "Gagal menyimpan posisi ke database" };
  }
};

export const deletePosition = async (positionId: string): Promise<boolean> => {
  if (!db) return false;
  const firestore = db;
  try {
    const { deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(firestore, COLL_POSITIONS, positionId));
    return true;
  } catch (err) {
    console.error("Gagal menghapus posisi:", err);
    return false;
  }
};

