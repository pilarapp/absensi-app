"use client";

import { useState, useEffect, useMemo } from "react";
import Toast from "@/components/Toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import dynamic from "next/dynamic";
import CustomSelect from "@/components/CustomSelect";
import { subscribeToRequests, updateRequestStatus, subscribeToLocations, addLocation, updateLocation, deleteLocation, subscribeToEmployees, subscribeToAllAttendance, subscribeToFinances, addFinanceTransaction, deleteFinanceTransaction, subscribeToSalaries, subscribeToNotifications, addNotification, paySalary } from "@/lib/db";

const MapSelector = dynamic(() => import("../../components/MapSelector"), { 
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-gray-100 animate-pulse rounded-xl flex items-center justify-center text-gray-500">
      <i className="fa-solid fa-map-location-dot text-2xl mr-2"></i> Memuat Peta...
    </div>
  )
});

type Laporan = {
  nama: string;
  posisi: string;
  tanggal: string;
  hari: string;
  jamMasuk: string;
  jamKeluar: string;
  status: string;
  keterangan: string;
};

type Karyawan = {
  id: string;
  nama: string;
  email: string;
  posisi: string;
  status: "Aktif" | "Nonaktif";
  lokasiId: string;
  shiftMasuk?: string;
  shiftKeluar?: string;
  gajiPokok: number;
  bpjsTk?: boolean;
  bpjsKes?: boolean;
  noInduk?: string;
  noWa?: string;
  foto?: string;
};

export type LokasiKerja = {
  id: string;
  nama: string;
  lat: number;
  lng: number;
  radius: number;
};



const initialKaryawan: Karyawan[] = [];



type Transaksi = {
  id: string;
  tanggal: string;
  keterangan: string;
  jenis: "Pemasukan" | "Pengeluaran";
  nominal: number;
};





export default function AdminDesktopPage() {
  const [activeMenu, setActiveMenuState] = useState<string>("dashboard");
  const [isMounted, setIsMounted] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
    const savedMenu = localStorage.getItem("pilar_admin_menu");
    if (savedMenu) {
      setActiveMenuState(savedMenu);
    }
  }, []);

  const setActiveMenu = (menu: string) => {
    setActiveMenuState(menu);
    localStorage.setItem("pilar_admin_menu", menu);
  };

  // Settings State
  const [locations, setLocations] = useState<LokasiKerja[]>([]);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [formLokasiNama, setFormLokasiNama] = useState("");
  const [officeLat, setOfficeLat] = useState("-6.200000");
  const [officeLng, setOfficeLng] = useState("106.816666");
  const [officeRadius, setOfficeRadius] = useState("50");
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Karyawan State
  const [karyawanList, setKaryawanList] = useState<Karyawan[]>(initialKaryawan);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKaryawan, setEditingKaryawan] = useState<Karyawan | null>(null);

  // Notification State
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<{id: number, msg: string, time: string}[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  
  // Form State
  const [formNoInduk, setFormNoInduk] = useState("");
  const [formNoWa, setFormNoWa] = useState("");
  const [formNama, setFormNama] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formPosisi, setFormPosisi] = useState("");
  const [formStatus, setFormStatus] = useState<"Aktif" | "Nonaktif">("Aktif");
  const [formLokasiId, setFormLokasiId] = useState("all");
  const [formShiftMasuk, setFormShiftMasuk] = useState("08:00");
  const [formShiftKeluar, setFormShiftKeluar] = useState("17:00");
  const [formGajiPokok, setFormGajiPokok] = useState("0");
  const [formBpjsTk, setFormBpjsTk] = useState(true);
  const [formBpjsKes, setFormBpjsKes] = useState(true);
  
  // Laporan & Keuangan & Payroll State
  const [riwayatLaporan, setRiwayatLaporan] = useState<any[]>([]);
  const [laporanBulan, setLaporanBulan] = useState(new Date().getMonth() + 1);
  const [laporanTahun, setLaporanTahun] = useState(new Date().getFullYear());
  const [laporanSearch, setLaporanSearch] = useState("");
  const [isLaporanModalOpen, setIsLaporanModalOpen] = useState(false);
  const [selectedLaporanKaryawan, setSelectedLaporanKaryawan] = useState<Karyawan | null>(null);
  const [dataGrafik, setDataGrafik] = useState<any[]>([]);
  const [dataGrafikKeuangan, setDataGrafikKeuangan] = useState<any[]>([]);
  const [transaksiKeuangan, setTransaksiKeuangan] = useState<Transaksi[]>([]);
  const [riwayatGaji, setRiwayatGaji] = useState<any[]>([]);
  const [dataGrafikGaji, setDataGrafikGaji] = useState<any[]>([]);
  const [activeGajiTab, setActiveGajiTab] = useState<"payroll" | "riwayat">("payroll");

  // Pengajuan State
  const [pengajuanList, setPengajuanList] = useState<any[]>([]);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedPengajuan, setSelectedPengajuan] = useState<any>(null);
  const [pengajuanTab, setPengajuanTab] = useState<"antrean" | "riwayat">("antrean");

  // Penggajian State
  const [workingDays, setWorkingDays] = useState(22);
  const [absences, setAbsences] = useState<Record<string, number>>({});
  const [showGajiChart, setShowGajiChart] = useState(true);
  const [selectedAdminSlip, setSelectedAdminSlip] = useState<any | null>(null);
  const [bpjsTkRate, setBpjsTkRate] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pilar_bpjs_tk_rate");
      return saved !== null ? parseFloat(saved) : 2;
    }
    return 2;
  });
  const [bpjsKesRate, setBpjsKesRate] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pilar_bpjs_kes_rate");
      return saved !== null ? parseFloat(saved) : 1;
    }
    return 1;
  });

  const handleUpdateBpjsTkRate = (val: number) => {
    const num = isNaN(val) ? 0 : val;
    setBpjsTkRate(num);
    if (typeof window !== "undefined") {
      localStorage.setItem("pilar_bpjs_tk_rate", num.toString());
    }
  };

  const handleUpdateBpjsKesRate = (val: number) => {
    const num = isNaN(val) ? 0 : val;
    setBpjsKesRate(num);
    if (typeof window !== "undefined") {
      localStorage.setItem("pilar_bpjs_kes_rate", num.toString());
    }
  };

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, message: string, onConfirm: () => void} | null>(null);

  useEffect(() => {
    // Load locations via Firestore
    const unsubscribeLocations = subscribeToLocations((data) => {
      if (data.length === 0) {
        // Fallback default if empty
        const defaultLoc = [{ id: "loc-1", nama: "Kantor Pusat", lat: -6.200000, lng: 106.816666, radius: 50 }];
        setLocations(defaultLoc);
      } else {
        setLocations(data);
      }
    });
    
    // Load karyawan
    const unsubscribeEmployees = subscribeToEmployees((data) => {
      setKaryawanList(data);
    });
    
    // Load pengajuan via Firestore
    const unsubscribeRequests = subscribeToRequests((data) => {
      // Urutkan dari yang terbaru
      data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPengajuanList(data);
    });

    // Load attendance
    const unsubscribeAttendance = subscribeToAllAttendance((data) => {
      // Map Firestore data to Laporan format
      const formatted = data.map(d => ({
        id: d.id,
        nama: d.karyawanNama || "Unknown",
        posisi: "-",
        tanggal: d.tanggal,
        hari: new Date(d.createdAt).toLocaleDateString('id-ID', { weekday: 'long' }),
        jamMasuk: d.jamMasuk || "-",
        jamKeluar: d.jamKeluar || "-",
        status: d.status || "Hadir",
        keterangan: "-"
      }));
      // Urutkan dari terbaru
      formatted.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      setRiwayatLaporan(formatted);

      // Generate Data Grafik
      const countByDay: Record<string, { Hadir: number, Izin: number, Absen: number }> = {
        'Senin': { Hadir: 0, Izin: 0, Absen: 0 },
        'Selasa': { Hadir: 0, Izin: 0, Absen: 0 },
        'Rabu': { Hadir: 0, Izin: 0, Absen: 0 },
        'Kamis': { Hadir: 0, Izin: 0, Absen: 0 },
        'Jumat': { Hadir: 0, Izin: 0, Absen: 0 },
      };
      formatted.forEach(f => {
         const day = f.hari;
         if (countByDay[day]) {
            if (f.status === 'Hadir' || f.status === 'Terlambat') countByDay[day].Hadir++;
            else if (f.status === 'Izin') countByDay[day].Izin++;
            else countByDay[day].Absen++;
         }
      });
      const generatedGrafik = Object.keys(countByDay).map(k => ({
         name: k,
         ...countByDay[k]
      }));
      setDataGrafik(generatedGrafik);
    });

    // Load finances
    const unsubscribeFinances = subscribeToFinances((data) => {
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransaksiKeuangan(data);
    });

    // Load salaries
    const unsubscribeSalaries = subscribeToSalaries(null, (data) => {
      let combined = data || [];
      if (combined.length === 0) {
        try {
          const savedGaji = typeof window !== "undefined" ? localStorage.getItem("pilar_gaji_karyawan") : null;
          if (savedGaji) {
            combined = JSON.parse(savedGaji);
          }
        } catch {}
      }
      combined.sort((a: any, b: any) => new Date(b.createdAt || b.tanggal).getTime() - new Date(a.createdAt || a.tanggal).getTime());
      setRiwayatGaji(combined);

      // Generate dynamic chart data for monthly salary expenses
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const chartPoints = [];
      for (let i = Math.max(0, currentMonth - 5); i <= currentMonth; i++) {
        const totalMonthSalary = combined.filter((s: any) => {
          const d = s.createdAt ? new Date(s.createdAt) : new Date(s.tanggal);
          return !isNaN(d.getTime()) && d.getMonth() === i && d.getFullYear() === currentYear;
        }).reduce((acc: number, curr: any) => acc + (Number(curr.gajiBersih) || 0), 0);

        chartPoints.push({
          name: monthNames[i],
          Pengeluaran: parseFloat((totalMonthSalary / 1000000).toFixed(2)),
          nominalAsli: totalMonthSalary
        });
      }
      setDataGrafikGaji(chartPoints);
    });

    return () => {
      unsubscribeRequests();
      unsubscribeLocations();
      unsubscribeEmployees();
      unsubscribeAttendance();
      unsubscribeFinances();
      unsubscribeSalaries();
    };
  }, []);

  const handleSaveLocation = async () => {
    if (!formLokasiNama) return showToast("Nama lokasi harus diisi.");
    
    if (editingLocationId) {
      // Update ke Firebase
      const success = await updateLocation(editingLocationId, {
        nama: formLokasiNama,
        lat: parseFloat(officeLat),
        lng: parseFloat(officeLng),
        radius: parseInt(officeRadius)
      });
      if (success) {
        showToast("Lokasi berhasil diperbarui!");
      } else {
        showToast("Gagal memperbarui lokasi.");
      }
    } else {
      // Tambah baru ke Firebase
      const success = await addLocation({
        nama: formLokasiNama,
        lat: parseFloat(officeLat),
        lng: parseFloat(officeLng),
        radius: parseInt(officeRadius)
      });
      if (success) {
        showToast("Lokasi baru berhasil ditambahkan!");
      } else {
        showToast("Gagal menambahkan lokasi.");
      }
    }
    
    setEditingLocationId(null);
    setFormLokasiNama("");
    setIsLocationModalOpen(false);
  };

  const handleDeleteLocation = (id: string) => {
    setConfirmModal({
      isOpen: true,
      message: "Apakah Anda yakin ingin menghapus lokasi ini?",
      onConfirm: async () => {
        const success = await deleteLocation(id);
        if (success) {
          showToast("Lokasi dihapus.");
        } else {
          showToast("Gagal menghapus lokasi.");
        }
        setConfirmModal(null);
      }
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 5000);
  };

  // Listen for Karyawan notifications (New Pengajuan)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'admin_notif' && e.newValue) {
        const notif = JSON.parse(e.newValue);
        showToast(notif.msg);
        
        // Add to notification list
        setNotifications(prev => [
          { id: notif.id, msg: notif.msg, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }, 
          ...prev
        ]);
        setUnreadCount(prev => prev + 1);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleApprove = async (id: string) => {
    await updateRequestStatus(id, "Disetujui");
    showToast("Pengajuan disetujui.");
    const req = pengajuanList.find((r: any) => r.id === id);
    if (req && req.karyawanId) {
      addNotification(req.karyawanId, "Pengajuan Disetujui", "Hore! Pengajuan Anda telah DISETUJUI oleh HRD.", "success");
    }
  };

  const openRejectModal = (id: string) => {
    setRejectId(id);
    setRejectReason("");
    setRejectModalOpen(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectId || !rejectReason) return showToast("Alasan harus diisi.");
    await updateRequestStatus(rejectId, "Revisi", rejectReason);
    setRejectModalOpen(false);
    showToast("Pengajuan dikembalikan untuk revisi.");
    
    // Find karyawanId
    const req = pengajuanList.find((r: any) => r.id === rejectId);
    if (req) {
      addNotification(req.karyawanId, "Revisi Pengajuan", `Pengajuan Anda memerlukan REVISI: ${rejectReason}`, "warning");
    }
  };

  const handleExportExcel = (karyawanToExport?: Karyawan | null) => {
    try {
      let matrixToExport = matrixLaporan;
      if (karyawanToExport) {
        matrixToExport = matrixLaporan.filter(m => m.nama === karyawanToExport.nama);
      }
      
      const dataToExport = matrixToExport.map(m => ({
        "Nama Karyawan": m.nama,
        "TLM": m.tlm,
        "TAM": m.tam,
        "TAP": m.tap,
        "A": m.a,
        "I": m.i,
        "S": m.s,
        "C": m.c,
        "Total Pelanggaran": m.total
      }));
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Rekap_Bulan_${laporanBulan}`);
      
      let filename = `Rekap_Absensi_PT_Pilar_Bulan_${laporanBulan}_${laporanTahun}.xlsx`;
      if (karyawanToExport) {
        filename = `Rekap_Absensi_${karyawanToExport.nama.replace(/\s+/g, '_')}_${laporanBulan}_${laporanTahun}.xlsx`;
      }
      
      XLSX.writeFile(wb, filename);
      showToast("Berhasil mengunduh Laporan Excel!");
    } catch (error) {
      showToast("Gagal membuat file Excel.");
    }
  };

  const handleExportGaji = () => {
    try {
      if (riwayatGaji.length === 0) {
        return showToast("Belum ada riwayat gaji untuk diekspor.");
      }
      const dataToExport = riwayatGaji.map((s: any) => ({
        "ID Slip": s.id,
        "Tanggal Cair": s.tanggal,
        "Nama Karyawan": s.nama,
        "Gaji Pokok": s.gajiPokok || 0,
        "Hari Alpa": s.alpa || 0,
        "Potongan Alpa": s.potonganAlpa || 0,
        "Potongan BPJS TK": s.potonganBpjsTk || 0,
        "Potongan BPJS Kes": s.potonganBpjsKes || 0,
        "Total Potongan": s.potongan || 0,
        "Gaji Bersih": s.gajiBersih || 0,
        "Status": "Berhasil"
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Riwayat Penggajian");
      XLSX.writeFile(wb, "Laporan_Penggajian_PT_Pilar.xlsx");
      showToast("Berhasil mengunduh Laporan Penggajian Excel!");
    } catch (error) {
      showToast("Gagal membuat file Excel.");
    }
  };

  // CRUD Karyawan Functions
  const openAddModal = () => {
    setEditingKaryawan(null);
    setFormNoInduk("");
    setFormNoWa("");
    setFormNama("");
    setFormEmail("");
    setFormPassword("");
    setFormPosisi("");
    setFormStatus("Aktif");
    setFormLokasiId("all");
    setFormShiftMasuk("08:00");
    setFormShiftKeluar("17:00");
    setFormGajiPokok("0");
    setFormBpjsTk(true);
    setFormBpjsKes(true);
    setIsModalOpen(true);
  };

  const openEditModal = (k: Karyawan) => {
    setEditingKaryawan(k);
    setFormNoInduk(k.noInduk || "");
    setFormNoWa(k.noWa || "");
    setFormNama(k.nama);
    setFormEmail(k.email);
    setFormPassword("••••••••"); // Pre-fill dengan titik-titik
    setFormPosisi(k.posisi);
    setFormStatus(k.status);
    setFormLokasiId(k.lokasiId || "all");
    setFormShiftMasuk(k.shiftMasuk || "08:00");
    setFormShiftKeluar(k.shiftKeluar || "17:00");
    setFormGajiPokok(k.gajiPokok ? k.gajiPokok.toString() : "0");
    setFormBpjsTk(k.bpjsTk !== undefined ? k.bpjsTk : true);
    setFormBpjsKes(k.bpjsKes !== undefined ? k.bpjsKes : true);
    setIsModalOpen(true);
  };

  const handleDeleteKaryawan = (id: string) => {
    setConfirmModal({
      isOpen: true,
      message: "Apakah Anda yakin ingin menghapus karyawan ini?",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/auth/karyawan?uid=${id}`, { method: 'DELETE' });
          if (res.ok) {
            showToast("Karyawan berhasil dihapus.");
          } else {
            const data = await res.json();
            showToast("Gagal: " + (data.error || 'Unknown error'));
          }
        } catch (error) {
          showToast("Gagal menghapus karyawan.");
        }
        setConfirmModal(null);
      }
    });
  };

  const handleSaveKaryawan = async () => {
    if (!formNama || !formEmail || !formPosisi) return showToast("Semua field wajib diisi.");
    if (!editingKaryawan && !formPassword) return showToast("Password wajib diisi untuk karyawan baru.");

    try {
      const res = await fetch('/api/auth/karyawan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingKaryawan?.id,
          noInduk: formNoInduk,
          noWa: formNoWa,
          nama: formNama,
          email: formEmail,
          password: formPassword === "••••••••" ? "" : formPassword,
          posisi: formPosisi,
          status: formStatus,
          lokasiId: formLokasiId,
          shiftMasuk: formShiftMasuk,
          shiftKeluar: formShiftKeluar,
          gajiPokok: parseInt(formGajiPokok) || 0,
          bpjsTk: formBpjsTk,
          bpjsKes: formBpjsKes
        })
      });

      const data = await res.json();

      if (res.ok) {
        showToast(editingKaryawan ? "Data karyawan berhasil diperbarui!" : "Karyawan baru berhasil ditambahkan!");
        setIsModalOpen(false);
      } else {
        showToast("Gagal menyimpan: " + (data.error || 'Unknown error'));
      }
    } catch (error) {
      showToast("Terjadi kesalahan sistem saat menyimpan data.");
    }
  };

  const handleBayarGaji = (
    karyawanId: string, 
    nominal: number, 
    nama: string, 
    gajiPokok: number, 
    potonganAlpa: number, 
    alpa: number,
    potonganBpjsTk: number = 0,
    potonganBpjsKes: number = 0,
    currentBpjsTkRate: number = 2,
    currentBpjsKesRate: number = 1
  ) => {
    if (nominal <= 0) return showToast("Nominal gaji tidak valid.");
    setConfirmModal({
      isOpen: true,
      message: `Apakah Anda yakin ingin mencairkan gaji sebesar Rp ${new Intl.NumberFormat('id-ID').format(nominal)} untuk ${nama}?`,
      onConfirm: async () => {
        const timestamp = Date.now();
        const dateStr = new Date().toLocaleDateString('id-ID');
        const totalPotongan = potonganAlpa + potonganBpjsTk + potonganBpjsKes;
        
        // 1. Catat ke Keuangan
        const newTrx: Transaksi = {
          id: "TRX-" + timestamp,
          tanggal: dateStr,
          keterangan: `Gaji - ${nama}`,
          jenis: "Pengeluaran",
          nominal: nominal
        };
        const newList = [newTrx, ...transaksiKeuangan];
        setTransaksiKeuangan(newList);
        localStorage.setItem("pilar_keuangan", JSON.stringify(newList));
        
        // 2. Catat ke Riwayat Gaji Karyawan (pilar_gaji_karyawan)
        const savedGaji = localStorage.getItem("pilar_gaji_karyawan");
        let riwayatGaji = savedGaji ? JSON.parse(savedGaji) : [];
        const newSlipGaji = {
          id: "SLIP-" + timestamp,
          karyawanId,
          nama,
          tanggal: dateStr,
          gajiPokok,
          potongan: totalPotongan,
          potonganAlpa,
          potonganBpjsTk,
          potonganBpjsKes,
          bpjsTkRate: currentBpjsTkRate,
          bpjsKesRate: currentBpjsKesRate,
          alpa,
          gajiBersih: nominal,
          createdAt: new Date().toISOString()
        };
        riwayatGaji = [newSlipGaji, ...riwayatGaji];
        localStorage.setItem("pilar_gaji_karyawan", JSON.stringify(riwayatGaji));

        // 3. Simpan ke Firebase (Slip Gaji, Keuangan, Notifikasi)
        try {
          await paySalary(
            newSlipGaji,
            {
              tanggal: dateStr,
              keterangan: `Gaji - ${nama}`,
              jenis: "Pengeluaran",
              nominal: nominal
            },
            {
              userId: karyawanId,
              title: "Pencairan Gaji",
              message: `Hore! Gaji bulan ini sebesar Rp ${new Intl.NumberFormat('id-ID').format(nominal)} telah masuk ke rekening Anda!`,
              type: "gaji",
              isRead: false
            }
          );
        } catch (e) {
          console.error("Gagal sinkron paySalary:", e);
        }

        // 4. Kirim Notifikasi lokal
        localStorage.setItem('user_notif', JSON.stringify({ 
          id: timestamp, 
          msg: `Hore! Gaji bulan ini sebesar Rp ${new Intl.NumberFormat('id-ID').format(nominal)} telah masuk ke rekening Anda!`
        }));

        showToast(`Gaji ${nama} berhasil dibayarkan!`);
        setConfirmModal(null);
      }
    });
  };

  const matrixLaporan = useMemo(() => {
    const filteredLaporan = riwayatLaporan.filter(log => {
       const logDate = new Date(log.tanggal);
       return logDate.getMonth() + 1 === laporanBulan && logDate.getFullYear() === laporanTahun;
    });

    const approvedIzinSakit = pengajuanList.filter(p => p.status === "Disetujui" && (p.type === "Izin Pribadi" || p.type === "Cuti Sakit" || p.type.includes("Cuti")));

    const getWorkingDaysInMonth = (month: number, year: number) => {
      let days = 0;
      const date = new Date(year, month - 1, 1);
      while (date.getMonth() === month - 1) {
        if (date.getDay() !== 0 && date.getDay() !== 6) days++;
        date.setDate(date.getDate() + 1);
      }
      return days;
    };
    const totalWorkingDays = getWorkingDaysInMonth(laporanBulan, laporanTahun);

    const matrix = karyawanList.map(karyawan => {
       const empLogs = filteredLaporan.filter(l => l.nama === karyawan.nama);
       
       let tlm = 0;
       let tam = 0;
       let tap = 0;
       let a = 0;
       let i = 0;
       let s = 0;
       let c = 0;

       const logsByDate: Record<string, any> = {};
       empLogs.forEach(l => {
          const dStr = new Date(l.tanggal).toISOString().split('T')[0];
          logsByDate[dStr] = l;
       });

       const leavesByDate: Record<string, string> = {};
       approvedIzinSakit.filter(p => p.karyawanId === karyawan.id).forEach(p => {
          const pStart = new Date(p.startDate);
          const pEnd = new Date(p.endDate);
          let curr = new Date(pStart);
          while(curr <= pEnd) {
             const dStr = curr.toISOString().split('T')[0];
             leavesByDate[dStr] = p.type;
             curr.setDate(curr.getDate() + 1);
          }
       });

       for (let day = 1; day <= new Date(laporanTahun, laporanBulan, 0).getDate(); day++) {
          const date = new Date(laporanTahun, laporanBulan - 1, day);
          if (date.getDay() === 0 || date.getDay() === 6) continue;
          if (date > new Date()) continue; 

          const dStr = date.toISOString().split('T')[0];
          
          if (leavesByDate[dStr]) {
             if (leavesByDate[dStr] === "Cuti Sakit") s++;
             else if (leavesByDate[dStr] === "Izin Pribadi" || leavesByDate[dStr] === "Izin") i++;
             else c++;
             continue;
          }

          const log = logsByDate[dStr];
          if (!log) {
             a++;
          } else {
             if (log.status === "Terlambat") tlm++;
             if (!log.jamMasuk || log.jamMasuk === "-") tam++;
             if (!log.jamKeluar || log.jamKeluar === "-") tap++;
          }
       }

       const totalPelanggaran = tlm + tam + tap + a;

       return {
          nama: karyawan.nama,
          posisi: karyawan.posisi || "-",
          tlm,
          tam,
          tap,
          a,
          i,
          s,
          c,
          total: totalPelanggaran
       };
    });
    
    if (laporanSearch) {
       return matrix.filter(m => m.nama.toLowerCase().includes(laporanSearch.toLowerCase()) || m.posisi.toLowerCase().includes(laporanSearch.toLowerCase()));
    }
    
    return matrix;
  }, [riwayatLaporan, pengajuanList, karyawanList, laporanBulan, laporanTahun, laporanSearch]);

  if (!isMounted) {
    return (
      <div className="flex h-screen w-full bg-gray-50 items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-pilar-gold rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-500 font-medium">Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-gray-50 text-sm text-gray-800 font-sans relative">
      
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[9999] pointer-events-auto min-w-[320px]">
          <Toast 
            type={toastMessage.toLowerCase().includes("gagal") || toastMessage.toLowerCase().includes("harus diisi") || toastMessage.toLowerCase().includes("tidak valid") || toastMessage.toLowerCase().includes("wajib") ? "error" : "success"}
            description={toastMessage} 
            onClose={() => setToastMessage("")} 
          />
        </div>
      )}

      {/* Modal Karyawan */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center relative shrink-0">
              <div className="absolute top-0 right-0 w-32 h-32 bg-pilar-gold/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
              <h3 className="font-extrabold text-xl text-gray-900 tracking-tight relative z-10">
                {editingKaryawan ? "Edit Karyawan" : "Tambah Karyawan Baru"}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center relative z-10">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            
            <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSaveKaryawan(); }} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-8 overflow-y-auto space-y-8 flex-1 bg-white">
                
                {/* 1. Data Pribadi & Kontak */}
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2 flex items-center"><i className="fa-solid fa-address-card mr-2"></i> 1. Data Pribadi & Kontak</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">No. Induk / KTP</label>
                      <input 
                        type="text" required value={formNoInduk} onChange={(e) => setFormNoInduk(e.target.value)}
                        placeholder="Wajib diisi"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all text-sm bg-gray-50/50 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Nama Lengkap</label>
                      <input 
                        type="text" required value={formNama} onChange={(e) => setFormNama(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all text-sm bg-gray-50/50 focus:bg-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">No. Whatsapp (WA)</label>
                      <input 
                        type="text" required value={formNoWa} onChange={(e) => setFormNoWa(e.target.value)}
                        placeholder="Contoh: 08123456789"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all text-sm bg-gray-50/50 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Akun Akses */}
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2 flex items-center"><i className="fa-solid fa-shield-halved mr-2"></i> 2. Akun & Keamanan</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Email Akses</label>
                      <input 
                        type="email" required value={formEmail} onChange={(e) => setFormEmail(e.target.value)} autoComplete="off"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all text-sm bg-gray-50/50 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Kata Sandi (Password)</label>
                      <input 
                        type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} autoComplete="new-password"
                        placeholder={editingKaryawan ? "Ketik untuk mengubah sandi" : "Minimal 6 karakter"}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all text-sm bg-gray-50/50 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Informasi Pekerjaan */}
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2 flex items-center"><i className="fa-solid fa-briefcase mr-2"></i> 3. Informasi Pekerjaan</h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Posisi / Jabatan</label>
                      <input 
                        type="text" required value={formPosisi} onChange={(e) => setFormPosisi(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all text-sm bg-gray-50/50 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Status</label>
                      <CustomSelect 
                        value={formStatus}
                        onChange={(val) => setFormStatus(val as "Aktif" | "Nonaktif")}
                        options={[
                          { value: "Aktif", label: "Aktif" },
                          { value: "Nonaktif", label: "Nonaktif" }
                        ]}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Lokasi Penugasan</label>
                    <CustomSelect 
                      value={formLokasiId}
                      onChange={(val) => setFormLokasiId(val)}
                      options={[
                        { value: "all", label: "Semua Cabang" },
                        ...locations.map(loc => ({ value: loc.id, label: loc.nama }))
                      ]}
                    />
                  </div>
                </div>

                {/* 4. Waktu & Kompensasi */}
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2 flex items-center"><i className="fa-solid fa-clock mr-2"></i> 4. Waktu & Kompensasi</h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Shift Masuk</label>
                      <input type="time" value={formShiftMasuk} onChange={(e) => setFormShiftMasuk(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all text-sm bg-gray-50/50 focus:bg-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Shift Pulang</label>
                      <input type="time" value={formShiftKeluar} onChange={(e) => setFormShiftKeluar(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all text-sm bg-gray-50/50 focus:bg-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Gaji Pokok (Per Bulan)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-gray-500 font-bold">Rp</span>
                      <input 
                        type="text" 
                        required 
                        value={formGajiPokok ? new Intl.NumberFormat('id-ID').format(Number(formGajiPokok)) : ""} 
                        onChange={(e) => setFormGajiPokok(e.target.value.replace(/\D/g, ''))}
                        className="w-full border border-gray-200 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all text-sm font-bold text-gray-900 bg-gray-50/50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center">
                      <i className="fa-solid fa-shield-halved mr-1.5 text-pilar-gold"></i>
                      Kepesertaan BPJS (Potongan Gaji)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className={`flex items-center p-3.5 rounded-xl border cursor-pointer transition-all select-none ${
                        formBpjsTk 
                          ? 'bg-white border-gray-300 shadow-sm hover:border-pilar-gold' 
                          : 'bg-gray-50 border-gray-200 opacity-60 hover:opacity-100'
                      }`}>
                        <input 
                          type="checkbox" 
                          checked={formBpjsTk} 
                          onChange={(e) => setFormBpjsTk(e.target.checked)} 
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all shrink-0 mr-3 ${
                          formBpjsTk 
                            ? "bg-pilar-darker text-pilar-gold shadow-sm" 
                            : "border-2 border-gray-300 bg-white"
                        }`}>
                          {formBpjsTk && <i className="fa-solid fa-check text-xs"></i>}
                        </div>
                        <div className="text-xs">
                          <span className={`font-bold block ${formBpjsTk ? "text-gray-800" : "text-gray-400"}`}>
                            BPJS Ketenagakerjaan
                          </span>
                          <span className={`text-[11px] ${formBpjsTk ? "text-gray-500" : "text-gray-400"}`}>
                            {formBpjsTk ? "Aktif dipotong" : "Tidak dipotong"}
                          </span>
                        </div>
                      </label>

                      <label className={`flex items-center p-3.5 rounded-xl border cursor-pointer transition-all select-none ${
                        formBpjsKes 
                          ? 'bg-white border-gray-300 shadow-sm hover:border-pilar-gold' 
                          : 'bg-gray-50 border-gray-200 opacity-60 hover:opacity-100'
                      }`}>
                        <input 
                          type="checkbox" 
                          checked={formBpjsKes} 
                          onChange={(e) => setFormBpjsKes(e.target.checked)} 
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all shrink-0 mr-3 ${
                          formBpjsKes 
                            ? "bg-pilar-darker text-pilar-gold shadow-sm" 
                            : "border-2 border-gray-300 bg-white"
                        }`}>
                          {formBpjsKes && <i className="fa-solid fa-check text-xs"></i>}
                        </div>
                        <div className="text-xs">
                          <span className={`font-bold block ${formBpjsKes ? "text-gray-800" : "text-gray-400"}`}>
                            BPJS Kesehatan
                          </span>
                          <span className={`text-[11px] ${formBpjsKes ? "text-gray-500" : "text-gray-400"}`}>
                            {formBpjsKes ? "Aktif dipotong" : "Tidak dipotong"}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

              </div>
              
              {/* Modal Footer */}
              <div className="px-8 py-5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors">Batal</button>
                <button type="submit" className="bg-pilar-darker text-pilar-gold font-bold px-8 py-3 rounded-xl shadow-md hover:bg-black hover:shadow-lg focus:ring-4 focus:ring-pilar-darker/20 transition-all flex items-center space-x-2">
                  <i className="fa-solid fa-save"></i>
                  <span>Simpan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Laporan Individu */}
      {isLaporanModalOpen && selectedLaporanKaryawan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center relative shrink-0">
                <h3 className="font-extrabold text-xl text-gray-900 tracking-tight relative z-10">
                  Laporan Absensi: {selectedLaporanKaryawan.nama}
                </h3>
                <button type="button" onClick={() => setIsLaporanModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center relative z-10">
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>
              <div className="p-8 overflow-y-auto">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 bg-pilar-darker text-white p-5 rounded-2xl gap-4 md:gap-0">
                    <div className="flex items-center space-x-4">
                       <div className="w-12 h-12 rounded-xl bg-white/10 overflow-hidden flex items-center justify-center font-black text-pilar-gold shrink-0">
                         {selectedLaporanKaryawan.foto ? (
                           <img src={selectedLaporanKaryawan.foto} alt={selectedLaporanKaryawan.nama} className="w-full h-full object-cover" />
                         ) : (
                           selectedLaporanKaryawan.nama.substring(0, 2).toUpperCase()
                         )}
                       </div>
                       <div>
                         <p className="font-bold text-lg">{selectedLaporanKaryawan.nama}</p>
                         <p className="text-sm text-gray-300">{selectedLaporanKaryawan.posisi}</p>
                       </div>
                    </div>
                    
                    <div className="flex items-center justify-between md:justify-end space-x-4 md:space-x-6 w-full md:w-auto border-t border-white/10 md:border-0 pt-4 md:pt-0 mt-2 md:mt-0">
                       <div className="text-left md:text-right">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Total Pelanggaran</p>
                          <div className="flex items-center md:justify-end space-x-2">
                             <div className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
                                <i className="fa-solid fa-triangle-exclamation text-xs"></i>
                             </div>
                             <span className="font-black text-xl text-white">
                               {matrixLaporan.find(m => m.nama === selectedLaporanKaryawan.nama)?.total || 0}
                             </span>
                          </div>
                       </div>
                       <div className="w-px h-10 bg-white/10 hidden md:block"></div>
                       <div className="text-right">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Periode</p>
                          <p className="font-bold text-pilar-gold text-base">{laporanBulan} / {laporanTahun}</p>
                       </div>
                    </div>
                 </div>
                 {matrixLaporan.filter(m => m.nama === selectedLaporanKaryawan.nama).map((row, idx) => (
                   <div key={idx} className="space-y-4 md:space-y-6">
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                         {/* Terlambat */}
                         <div className="flex items-center justify-between p-4 md:px-6 hover:bg-gray-50 transition-colors group">
                            <div className="flex items-center space-x-4">
                               <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center group-hover:scale-110 group-hover:bg-gray-200 transition-all">
                                  <i className="fa-solid fa-clock text-lg"></i>
                               </div>
                               <p className="text-sm font-bold text-gray-800 uppercase tracking-wide">Terlambat (TLM)</p>
                            </div>
                            <p className="text-2xl font-black text-gray-800">{row.tlm}</p>
                         </div>
                         {/* Tdk Masuk */}
                         <div className="flex items-center justify-between p-4 md:px-6 hover:bg-gray-50 transition-colors group">
                            <div className="flex items-center space-x-4">
                               <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center group-hover:scale-110 group-hover:bg-gray-200 transition-all">
                                  <i className="fa-solid fa-user-xmark text-lg"></i>
                               </div>
                               <p className="text-sm font-bold text-gray-800 uppercase tracking-wide">Tdk Masuk (TAM)</p>
                            </div>
                            <p className="text-2xl font-black text-gray-800">{row.tam}</p>
                         </div>
                         {/* Tdk Pulang */}
                         <div className="flex items-center justify-between p-4 md:px-6 hover:bg-gray-50 transition-colors group">
                            <div className="flex items-center space-x-4">
                               <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center group-hover:scale-110 group-hover:bg-gray-200 transition-all">
                                  <i className="fa-solid fa-person-walking-arrow-right text-lg"></i>
                               </div>
                               <p className="text-sm font-bold text-gray-800 uppercase tracking-wide">Tdk Pulang (TAP)</p>
                            </div>
                            <p className="text-2xl font-black text-gray-800">{row.tap}</p>
                         </div>
                         {/* Alpha */}
                         <div className="flex items-center justify-between p-4 md:px-6 hover:bg-gray-50 transition-colors group">
                            <div className="flex items-center space-x-4">
                               <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center group-hover:scale-110 group-hover:bg-gray-200 transition-all">
                                  <i className="fa-solid fa-circle-xmark text-lg"></i>
                               </div>
                               <p className="text-sm font-bold text-gray-800 uppercase tracking-wide">Alpha (A)</p>
                            </div>
                            <p className="text-2xl font-black text-gray-800">{row.a}</p>
                         </div>
                         {/* Izin */}
                         <div className="flex items-center justify-between p-4 md:px-6 hover:bg-gray-50 transition-colors group">
                            <div className="flex items-center space-x-4">
                               <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center group-hover:scale-110 group-hover:bg-gray-200 transition-all">
                                  <i className="fa-solid fa-envelope-open-text text-lg"></i>
                               </div>
                               <p className="text-sm font-bold text-gray-800 uppercase tracking-wide">Izin (I)</p>
                            </div>
                            <p className="text-2xl font-black text-gray-800">{row.i}</p>
                         </div>
                         {/* Sakit */}
                         <div className="flex items-center justify-between p-4 md:px-6 hover:bg-gray-50 transition-colors group">
                            <div className="flex items-center space-x-4">
                               <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center group-hover:scale-110 group-hover:bg-gray-200 transition-all">
                                  <i className="fa-solid fa-house-medical text-lg"></i>
                               </div>
                               <p className="text-sm font-bold text-gray-800 uppercase tracking-wide">Sakit (S)</p>
                            </div>
                            <p className="text-2xl font-black text-gray-800">{row.s}</p>
                         </div>
                         {/* Cuti */}
                         <div className="flex items-center justify-between p-4 md:px-6 hover:bg-gray-50 transition-colors group">
                            <div className="flex items-center space-x-4">
                               <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center group-hover:scale-110 group-hover:bg-gray-200 transition-all">
                                  <i className="fa-solid fa-calendar-check text-lg"></i>
                               </div>
                               <p className="text-sm font-bold text-gray-800 uppercase tracking-wide">Cuti (C)</p>
                            </div>
                            <p className="text-2xl font-black text-gray-800">{row.c}</p>
                         </div>
                      </div>


                   </div>
                 ))}
                 {matrixLaporan.filter(m => m.nama === selectedLaporanKaryawan.nama).length === 0 && (
                   <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
                     <i className="fa-solid fa-folder-open text-4xl text-gray-300 mb-3 block"></i>
                     <p className="text-gray-500">Tidak ada data untuk bulan ini.</p>
                   </div>
                 )}
              </div>
              <div className="px-8 py-5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3 shrink-0">
                 <button type="button" onClick={() => setIsLaporanModalOpen(false)} className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors">Tutup</button>
                 <button 
                   onClick={() => handleExportExcel(selectedLaporanKaryawan)}
                   className="bg-pilar-darker hover:bg-black text-pilar-gold font-bold px-6 py-3 rounded-xl shadow-md hover:shadow-lg focus:ring-4 focus:ring-pilar-darker/20 transition-all flex items-center justify-center space-x-2"
                 >
                   <i className="fa-solid fa-file-excel text-lg"></i>
                   <span>Export Karyawan Ini</span>
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-56 bg-pilar-darker text-white flex flex-col shadow-xl z-20 hidden md:flex print:hidden">
        <div className="p-6 border-b border-white/10 flex justify-center items-center">
          <img 
            src="https://res.cloudinary.com/sgcxykbd/image/upload/v1788788863/logo_horizontal.png" 
            alt="Logo PT. PILAR" 
            className="w-36 h-auto object-contain" 
          />
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveMenu("dashboard")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeMenu === "dashboard" ? "bg-pilar-gold text-pilar-darker font-bold" : "text-pilar-textSecondary hover:bg-white/10 hover:text-white"}`}
          >
            <i className="fa-solid fa-chart-pie w-5"></i>
            <span>Dashboard</span>
          </button>
          
          <button 
            onClick={() => setActiveMenu("karyawan")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeMenu === "karyawan" ? "bg-pilar-gold text-pilar-darker font-bold" : "text-pilar-textSecondary hover:bg-white/10 hover:text-white"}`}
          >
            <i className="fa-solid fa-users-gear w-5"></i>
            <span>Kelola Karyawan</span>
          </button>

          <button 
            onClick={() => setActiveMenu("pengajuan")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeMenu === "pengajuan" ? "bg-pilar-gold text-pilar-darker font-bold" : "text-pilar-textSecondary hover:bg-white/10 hover:text-white"}`}
          >
            <i className="fa-solid fa-clipboard-check w-5"></i>
            <span>Persetujuan</span>
          </button>



          <button 
            onClick={() => setActiveMenu("penggajian")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeMenu === "penggajian" ? "bg-pilar-gold text-pilar-darker font-bold" : "text-pilar-textSecondary hover:bg-white/10 hover:text-white"}`}
          >
            <i className="fa-solid fa-money-bill-wave w-5"></i>
            <span className="whitespace-nowrap">Penggajian</span>
          </button>

          <button 
            onClick={() => setActiveMenu("pengaturan")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeMenu === "pengaturan" ? "bg-pilar-gold text-pilar-darker font-bold" : "text-pilar-textSecondary hover:bg-white/10 hover:text-white"}`}
          >
            <i className="fa-solid fa-cog w-5"></i>
            <span>Pengaturan</span>
          </button>
        </nav>

        <div className="p-4 border-t border-white/10">
          <button onClick={() => router.push("/admin/login")} className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
            <i className="fa-solid fa-sign-out-alt w-5"></i>
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden print:hidden">
        {/* Topbar */}
        <header className="bg-white h-16 shadow-sm border-b border-gray-200 flex items-center justify-between px-6 z-10">
          <h2 className="text-xl font-bold text-gray-800">
            {activeMenu === "dashboard" ? "Dashboard HRD" : 
             activeMenu === "karyawan" ? "Manajemen Karyawan" :
             activeMenu === "pengajuan" ? "Persetujuan Pengajuan" :
             activeMenu === "penggajian" ? "Penggajian Karyawan (Payroll)" :
             activeMenu === "pengaturan" ? "Pengaturan Sistem" :
             "Laporan Absensi Karyawan"}
          </h2>
          <div className="flex items-center space-x-4 relative">
            <div 
              onClick={() => { setShowNotifDropdown(!showNotifDropdown); setUnreadCount(0); }}
              className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 cursor-pointer transition relative"
            >
              <i className="fa-solid fa-bell"></i>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center shadow-md animate-pulse leading-none">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>

            {/* Notification Dropdown */}
            {showNotifDropdown && (
              <div className="absolute top-12 right-32 md:right-48 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-fade-in">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                  <h3 className="font-bold text-gray-800 text-sm">Notifikasi</h3>
                  {notifications.length > 0 && (
                    <span onClick={() => setNotifications([])} className="text-xs text-pilar-gold font-semibold cursor-pointer hover:underline">Hapus Semua</span>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                  {notifications.length > 0 ? (
                     notifications.map(n => (
                       <div 
                         key={n.id} 
                         onClick={() => {
                           setActiveMenu("pengajuan");
                           setShowNotifDropdown(false);
                         }}
                         className="p-4 hover:bg-gray-50 cursor-pointer transition group"
                       >
                         <div className="flex items-start space-x-3">
                           <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 group-hover:bg-pilar-gold group-hover:text-white transition-colors flex items-center justify-center flex-shrink-0 mt-0.5">
                             <i className="fa-solid fa-info-circle text-xs"></i>
                           </div>
                           <div>
                             <p className="text-sm font-medium text-gray-800 leading-snug">{n.msg}</p>
                             <p className="text-xs text-gray-400 mt-1">{n.time}</p>
                           </div>
                         </div>
                       </div>
                     ))
                  ) : (
                    <div className="p-8 flex flex-col items-center text-center text-gray-400">
                      <i className="fa-regular fa-bell-slash text-3xl mb-2 text-gray-300"></i>
                      <p className="text-sm">Belum ada notifikasi baru.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center space-x-3 border-l border-gray-200 pl-4">
              <div className="w-10 h-10 bg-pilar-darker rounded-full text-white flex items-center justify-center font-bold">
                A
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">Admin Utama</p>
                <p className="text-xs text-gray-500">HR Manager</p>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          
          {/* DASHBOARD TAB */}
          {activeMenu === "dashboard" && (
            <div className="space-y-8 animate-slide-up">
              {/* Shortcut to Pengajuan */}
              {(() => {
                const pendingCount = pengajuanList.filter(p => p.status === "Menunggu").length;
                if (pendingCount === 0) return null;

                return (
                  <div 
                    onClick={() => setActiveMenu("pengajuan")}
                    className="group relative bg-pilar-darker cursor-pointer rounded-[2rem] shadow-xl shadow-pilar-darker/20 p-6 flex items-center justify-between transition-all duration-300 hover:shadow-pilar-darker/40 hover:-translate-y-1 overflow-hidden"
                  >
                    {/* Decorative circles */}
                    <div className="absolute right-0 top-0 w-64 h-64 bg-pilar-gold/10 rounded-full blur-3xl -mr-32 -mt-32 transition-transform group-hover:scale-150 duration-700"></div>
                    <div className="absolute left-0 bottom-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -ml-10 -mb-10"></div>
                    
                    <div className="flex items-center space-x-6 relative z-10">
                      <div className="w-16 h-16 bg-white/10 backdrop-blur-md text-pilar-gold rounded-2xl flex items-center justify-center text-2xl border border-white/10 shadow-inner group-hover:rotate-12 transition-transform duration-300">
                        <i className="fa-solid fa-clipboard-list"></i>
                      </div>
                      <div>
                        <h3 className="font-extrabold text-white text-2xl tracking-tight flex items-center gap-3">
                          Ada {pendingCount} Pengajuan Menunggu!
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pilar-gold opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-pilar-gold"></span>
                          </span>
                        </h3>
                        <p className="text-gray-300 font-medium mt-1">Klik di sini untuk meninjau pengajuan cuti, sakit, dan izin karyawan.</p>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-pilar-gold/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-pilar-gold/30 group-hover:bg-pilar-gold group-hover:text-pilar-darker text-pilar-gold transition-colors duration-300 relative z-10">
                      <i className="fa-solid fa-arrow-right text-xl"></i>
                    </div>
                  </div>
                );
              })()}

              {/* Header section inside dashboard */}
              <div className="mb-2 mt-4">
                <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Overview</h2>
                <p className="text-gray-500 mt-1">Pantau aktivitas kehadiran dan pengajuan hari ini.</p>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="group bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60 flex flex-col justify-between hover:-translate-y-1 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-pilar-gold/10 rounded-full blur-3xl -mr-10 -mt-10 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-start z-10">
                    <div className="w-14 h-14 bg-pilar-darker text-pilar-gold rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-gray-200 transform group-hover:scale-110 transition-transform duration-300">
                      <i className="fa-solid fa-users"></i>
                    </div>
                    <span className="bg-gray-100 text-pilar-darker text-xs font-bold px-3 py-1 rounded-full">+12%</span>
                  </div>
                  <div className="mt-6 z-10">
                    <p className="text-sm text-gray-500 font-medium mb-1">Karyawan Hadir Hari Ini</p>
                    <p className="text-4xl font-black text-gray-800 tracking-tight">124</p>
                  </div>
                </div>

                <div className="group bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60 flex flex-col justify-between hover:-translate-y-1 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-pilar-gold/10 rounded-full blur-3xl -mr-10 -mt-10 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-start z-10">
                    <div className="w-14 h-14 bg-pilar-gold text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-gray-200 transform group-hover:scale-110 transition-transform duration-300">
                      <i className="fa-solid fa-envelope-open-text"></i>
                    </div>
                    <span className="bg-gray-100 text-gray-700 text-xs font-bold px-3 py-1 rounded-full">Tetap</span>
                  </div>
                  <div className="mt-6 z-10">
                    <p className="text-sm text-gray-500 font-medium mb-1">Izin & Cuti</p>
                    <p className="text-4xl font-black text-gray-800 tracking-tight">5</p>
                  </div>
                </div>

                <div className="group bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60 flex flex-col justify-between hover:-translate-y-1 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gray-100 rounded-full blur-3xl -mr-10 -mt-10 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-start z-10">
                    <div className="w-14 h-14 bg-gray-200 text-gray-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-gray-100 transform group-hover:scale-110 transition-transform duration-300">
                      <i className="fa-solid fa-user-xmark"></i>
                    </div>
                    <span className="bg-gray-100 text-gray-700 text-xs font-bold px-3 py-1 rounded-full">-2</span>
                  </div>
                  <div className="mt-6 z-10">
                    <p className="text-sm text-gray-500 font-medium mb-1">Absen (Tanpa Keterangan)</p>
                    <p className="text-4xl font-black text-gray-800 tracking-tight">2</p>
                  </div>
                </div>

                <div className="group bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60 flex flex-col justify-between hover:-translate-y-1 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-pilar-gold/10 rounded-full blur-3xl -mr-10 -mt-10 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-start z-10">
                    <div className="w-14 h-14 bg-pilar-darker text-pilar-gold rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-gray-200 transform group-hover:scale-110 transition-transform duration-300">
                      <i className="fa-solid fa-wallet"></i>
                    </div>
                    <span 
                      onClick={() => setActiveMenu("penggajian")}
                      className="bg-gray-100 text-gray-700 hover:bg-pilar-gold hover:text-pilar-darker cursor-pointer text-xs font-bold px-3 py-1 rounded-full transition-colors"
                    >
                      Payroll
                    </span>
                  </div>
                  <div className="mt-6 z-10">
                    <p className="text-sm text-gray-500 font-medium mb-1">Total Pengeluaran Gaji</p>
                    <p className="text-xl sm:text-2xl font-black text-gray-800 tracking-tight">
                      Rp {new Intl.NumberFormat('id-ID').format(riwayatGaji.reduce((acc, curr) => acc + (Number(curr.gajiBersih) || 0), 0))}
                    </p>
                  </div>
                </div>
              </div>

              {/* Graphic Chart */}
              <div className="bg-white p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pilar-gold via-pilar-darker to-pilar-gold opacity-50"></div>
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <h3 className="font-extrabold text-xl text-gray-800">Statistik Kehadiran Mingguan</h3>
                    <p className="text-sm text-gray-500 mt-1">Tren kehadiran karyawan 5 hari terakhir</p>
                  </div>
                  <div className="hidden sm:flex space-x-2">
                    <button className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition">Minggu Ini</button>
                    <button className="px-4 py-2 bg-transparent text-gray-400 rounded-xl text-sm font-bold hover:text-gray-600 transition">Bulan Ini</button>
                  </div>
                </div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dataGrafik}
                      margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12, fontWeight: 500}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12, fontWeight: 500}} />
                      <Tooltip 
                        cursor={{fill: '#f9fafb'}}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', padding: '12px 16px', fontWeight: 'bold' }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '20px' }} />
                      <Bar dataKey="Hadir" fill="#060f1c" radius={[6, 6, 0, 0]} maxBarSize={50} />
                      <Bar dataKey="Izin" fill="#d4af37" radius={[6, 6, 0, 0]} maxBarSize={50} />
                      <Bar dataKey="Absen" fill="#9ca3af" radius={[6, 6, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Kinerja Karyawan Section */}
              <div className="bg-white p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-pilar-darker/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="flex justify-between items-end mb-8 relative z-10">
                  <div>
                    <h3 className="font-extrabold text-xl text-gray-800">Kinerja Karyawan</h3>
                    <p className="text-sm text-gray-500 mt-1">Berdasarkan tingkat kehadiran dan kedisiplinan bulan ini</p>
                  </div>
                  <button onClick={() => setActiveMenu("karyawan")} className="text-sm text-pilar-gold font-bold hover:text-pilar-darker transition-colors flex items-center gap-2 group">
                    Lihat Semua <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                  {(() => {
                    if (karyawanList.length === 0) return <div className="col-span-3 text-center text-gray-400 py-8">Belum ada data kinerja</div>;
                    
                    const scores = karyawanList.map(emp => {
                      const empAttendances = riwayatLaporan.filter(r => r.nama === emp.nama && (r.status === "Hadir" || r.status === "Terlambat"));
                      const hadirDays = empAttendances.length;
                      let score = Math.round((hadirDays / workingDays) * 100);
                      if (score > 100) score = 100;
                      return { ...emp, score };
                    }).sort((a, b) => b.score - a.score).slice(0, 3);

                    const topStyles = [
                      { icon: 'fa-trophy', iconBg: 'bg-green-100', iconColor: 'text-green-600' },
                      { icon: 'fa-star', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
                      { icon: 'fa-arrow-trend-up', iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600' }
                    ];

                    return scores.map((emp, index) => {
                      const style = topStyles[index] || topStyles[0];
                      return (
                        <div key={emp.id} className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100 hover:border-pilar-gold/30 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                          <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-full bg-pilar-darker text-pilar-gold overflow-hidden flex items-center justify-center font-bold text-sm">
                                {emp.foto ? (
                                  <img src={emp.foto} alt={emp.nama} className="w-full h-full object-cover" />
                                ) : (
                                  emp.nama.substring(0, 2).toUpperCase()
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-gray-800 text-sm">{emp.nama}</p>
                                <p className="text-xs text-gray-500">{emp.posisi}</p>
                              </div>
                            </div>
                            <div className={`w-8 h-8 rounded-full ${style.iconBg} ${style.iconColor} flex items-center justify-center`}>
                              <i className={`fa-solid ${style.icon} text-sm`}></i>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs font-bold text-gray-600 mb-2">
                              <span>Skor Kehadiran</span>
                              <span className="text-pilar-darker">{emp.score}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div className="bg-pilar-gold h-1.5 rounded-full" style={{ width: `${emp.score}%` }}></div>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* PENGAJUAN TAB */}
          {activeMenu === "pengajuan" && (
            <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60 overflow-hidden animate-slide-up">
              <div className="px-8 py-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center bg-gray-50/50 gap-4">
                <div className="flex bg-gray-200/50 p-1 rounded-xl">
                  <button 
                    onClick={() => setPengajuanTab("antrean")}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                      pengajuanTab === "antrean" ? "bg-white text-pilar-darker shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Antrean Persetujuan
                  </button>
                  <button 
                    onClick={() => setPengajuanTab("riwayat")}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                      pengajuanTab === "riwayat" ? "bg-white text-pilar-darker shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Riwayat Pengajuan
                  </button>
                </div>
                
                {pengajuanTab === "antrean" && (
                  <span className="bg-pilar-gold text-pilar-darker text-xs font-bold px-4 py-2 rounded-full shadow-sm">
                    {pengajuanList.filter(p => p.status === "Menunggu").length} Pending
                  </span>
                )}
              </div>
              
              <div className="p-0">
                {pengajuanTab === "antrean" ? (
                  pengajuanList.filter(p => p.status === "Menunggu").length === 0 ? (
                    <div className="py-16 text-center">
                      <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                        <i className="fa-solid fa-folder-open text-3xl text-gray-300"></i>
                      </div>
                      <p className="text-gray-500 font-medium text-lg">Tidak ada antrean persetujuan saat ini.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto p-6 -mt-2">
                      <table className="w-full text-left text-sm whitespace-nowrap border-separate" style={{borderSpacing: "0 16px"}}>
                        <thead>
                          <tr className="text-gray-500 font-semibold">
                            <th className="px-6 py-2 font-medium">Karyawan</th>
                            <th className="px-6 py-2 font-medium">Jenis Pengajuan</th>
                            <th className="px-6 py-2 font-medium">Tanggal</th>
                            <th className="px-6 py-2 font-medium">Durasi</th>
                            <th className="px-6 py-2 font-medium text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pengajuanList.filter(p => p.status === "Menunggu").map((pengajuan) => (
                            <tr key={pengajuan.id} className="group transition-all duration-300 hover:-translate-y-1 relative z-10">
                              <td className="px-6 py-5 bg-white rounded-l-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-l border-gray-100 group-hover:border-pilar-gold/40 transition-all">
                                <div className="flex items-center space-x-4">
                                  <div className="w-12 h-12 rounded-2xl bg-gray-50 overflow-hidden flex items-center justify-center font-black text-pilar-darker border border-gray-100 shadow-inner group-hover:border-pilar-gold/40 transition-colors">
                                    {(() => {
                                      const foto = karyawanList.find(k => k.id === pengajuan.karyawanId || k.nama === pengajuan.karyawanNama || (k as any).noInduk === pengajuan.karyawanId || (k as any).karyawanId === pengajuan.karyawanId)?.foto;
                                      return foto ? (
                                        <img src={foto} alt={pengajuan.karyawanNama || "Karyawan"} className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="group-hover:text-pilar-gold transition-colors">
                                          {pengajuan.karyawanNama ? pengajuan.karyawanNama.substring(0, 2).toUpperCase() : "??"}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  <div className="flex flex-col justify-center">
                                    <div className="font-extrabold text-gray-800 text-base">
                                      {pengajuan.karyawanNama}
                                      {pengajuan.isRevision && (
                                        <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-600 border border-orange-200 uppercase tracking-wider align-middle" title="Pengajuan ini merupakan hasil revisi">Revisi</span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-gray-500 mt-0.5 font-semibold tracking-wide">
                                      NIK: {karyawanList.find(k => k.id === pengajuan.karyawanId || k.nama === pengajuan.karyawanNama || (k as any).noInduk === pengajuan.karyawanId || (k as any).karyawanId === pengajuan.karyawanId)?.noInduk || "-"}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              
                              <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all">
                                <span className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm border bg-gray-100 text-gray-600 border-gray-200">
                                  {pengajuan.type}
                                </span>
                              </td>
                              
                              <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-gray-600 font-medium">
                                <div className="flex items-center space-x-2">
                                  <i className="fa-solid fa-calendar-day text-gray-400"></i>
                                  <span>{pengajuan.startDate}</span>
                                </div>
                              </td>
                              
                              <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-gray-600 font-medium">
                                <div className="flex items-center space-x-2">
                                  <i className="fa-solid fa-clock text-gray-400"></i>
                                  <span>{pengajuan.duration} Hari</span>
                                </div>
                              </td>
                              
                              <td className="px-6 py-5 bg-white rounded-r-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-r border-gray-100 group-hover:border-pilar-gold/40 transition-all text-right">
                                <button 
                                  onClick={() => {
                                    setSelectedPengajuan(pengajuan);
                                    setDetailModalOpen(true);
                                  }}
                                  className="inline-flex items-center justify-center px-6 py-2.5 bg-pilar-darker hover:bg-black text-pilar-gold font-bold rounded-xl text-sm transition-all shadow-md hover:shadow-lg focus:ring-4 focus:ring-pilar-darker/20"
                                >
                                  <span>Cek Detail</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  pengajuanList.filter(p => p.status !== "Menunggu").length === 0 ? (
                    <div className="py-16 text-center">
                      <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                        <i className="fa-solid fa-history text-3xl text-gray-300"></i>
                      </div>
                      <p className="text-gray-500 font-medium text-lg">Belum ada riwayat pengajuan.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto p-6 -mt-2">
                      <table className="w-full text-left text-sm whitespace-nowrap border-separate" style={{borderSpacing: "0 16px"}}>
                        <thead>
                          <tr className="text-gray-500 font-semibold">
                            <th className="px-6 py-2 font-medium">Karyawan</th>
                            <th className="px-6 py-2 font-medium">Jenis Pengajuan</th>
                            <th className="px-6 py-2 font-medium">Tanggal</th>
                            <th className="px-6 py-2 font-medium">Durasi</th>
                            <th className="px-6 py-2 font-medium">Status</th>
                            <th className="px-6 py-2 font-medium text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pengajuanList.filter(p => p.status !== "Menunggu").map((pengajuan) => (
                            <tr key={pengajuan.id} className="group transition-all duration-300 hover:-translate-y-1 relative z-10">
                              <td className="px-6 py-5 bg-white rounded-l-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-l border-gray-100 group-hover:border-pilar-gold/40 transition-all">
                                <div className="flex items-center space-x-4">
                                  <div className="w-12 h-12 rounded-2xl bg-gray-50 overflow-hidden flex items-center justify-center font-black text-pilar-darker border border-gray-100 shadow-inner group-hover:border-pilar-gold/40 transition-colors">
                                    {(() => {
                                      const foto = karyawanList.find(k => k.id === pengajuan.karyawanId || k.nama === pengajuan.karyawanNama || (k as any).noInduk === pengajuan.karyawanId || (k as any).karyawanId === pengajuan.karyawanId)?.foto;
                                      return foto ? (
                                        <img src={foto} alt={pengajuan.karyawanNama || "Karyawan"} className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="group-hover:text-pilar-gold transition-colors">
                                          {pengajuan.karyawanNama ? pengajuan.karyawanNama.substring(0, 2).toUpperCase() : "??"}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  <div className="flex flex-col justify-center">
                                    <div className="font-extrabold text-gray-800 text-base">{pengajuan.karyawanNama}</div>
                                    <div className="text-[11px] text-gray-500 mt-0.5 font-semibold tracking-wide">
                                      NIK: {karyawanList.find(k => k.id === pengajuan.karyawanId || k.nama === pengajuan.karyawanNama || (k as any).noInduk === pengajuan.karyawanId || (k as any).karyawanId === pengajuan.karyawanId)?.noInduk || "-"}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              
                              <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all">
                                <span className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm border bg-gray-100 text-gray-600 border-gray-200">
                                  {pengajuan.type}
                                </span>
                              </td>
                              
                              <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-gray-600 font-medium">
                                <div className="flex items-center space-x-2">
                                  <i className="fa-solid fa-calendar-day text-gray-400"></i>
                                  <span>{pengajuan.startDate}</span>
                                </div>
                              </td>
                              
                              <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-gray-600 font-medium">
                                <div className="flex items-center space-x-2">
                                  <i className="fa-solid fa-clock text-gray-400"></i>
                                  <span>{pengajuan.duration} Hari</span>
                                </div>
                              </td>
                              
                              <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all">
                                <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm border
                                  ${pengajuan.status === "Disetujui" ? "bg-green-100 text-green-700 border-green-200" : 
                                    pengajuan.status === "Revisi" ? "bg-red-100 text-red-600 border-red-200" : 
                                    "bg-gray-100 text-gray-500 border-gray-200"}`
                                }>
                                  {pengajuan.status}
                                </span>
                              </td>
                              
                              <td className="px-6 py-5 bg-white rounded-r-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-r border-gray-100 group-hover:border-pilar-gold/40 transition-all text-right">
                                <button 
                                  onClick={() => {
                                    setSelectedPengajuan(pengajuan);
                                    setDetailModalOpen(true);
                                  }}
                                  className="inline-flex items-center justify-center px-6 py-2.5 bg-pilar-darker hover:bg-black text-pilar-gold font-bold rounded-xl text-sm transition-all shadow-md hover:shadow-lg focus:ring-4 focus:ring-pilar-darker/20"
                                >
                                  <span>Cek Detail</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* KARYAWAN TAB (CRUD) */}
          {activeMenu === "karyawan" && (
            <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60 overflow-hidden animate-slide-up">
              <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row md:justify-between md:items-center bg-gray-50/50 space-y-4 md:space-y-0">
                <div className="flex flex-col md:flex-row items-center space-y-3 md:space-y-0 md:space-x-4 w-full md:w-auto">
                  <div className="relative w-full md:w-auto">
                    <input type="text" placeholder="Cari karyawan..." className="w-full md:w-64 border border-gray-200 rounded-xl pl-11 pr-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all" />
                    <i className="fa-solid fa-search absolute left-4 top-3 text-gray-400"></i>
                  </div>
                  <div className="relative w-full md:w-auto">
                    <input 
                      type="month" 
                      value={`${laporanTahun}-${laporanBulan.toString().padStart(2, '0')}`}
                      onChange={(e) => {
                        if (e.target.value) {
                          const [y, m] = e.target.value.split('-');
                          setLaporanTahun(parseInt(y));
                          setLaporanBulan(parseInt(m));
                        }
                      }}
                      className="w-full md:w-auto border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all" 
                    />
                  </div>
                </div>
                <div className="flex flex-col md:flex-row items-center space-y-3 md:space-y-0 md:space-x-4 w-full md:w-auto">
                  <button 
                    onClick={() => handleExportExcel(null)}
                    className="w-full md:w-auto bg-pilar-darker hover:bg-black text-pilar-gold font-bold px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg focus:ring-4 focus:ring-pilar-darker/20 transition-all flex items-center justify-center"
                  >
                    <span>Export Excel</span>
                  </button>
                  <button 
                    onClick={openAddModal}
                    className="w-full md:w-auto bg-pilar-darker hover:bg-black text-pilar-gold font-bold px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg focus:ring-4 focus:ring-pilar-darker/20 transition-all flex items-center justify-center"
                  >
                    <span>Tambah Karyawan</span>
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto p-6 -mt-2">
                <table className="w-full text-left text-sm whitespace-nowrap border-separate" style={{borderSpacing: "0 16px"}}>
                  <thead>
                    <tr className="text-gray-500 font-semibold">
                      <th className="px-6 py-2 font-medium">Nama Lengkap</th>
                      <th className="px-6 py-2 font-medium">Email</th>
                      <th className="px-6 py-2 font-medium">Posisi</th>
                      <th className="px-6 py-2 font-medium">Lokasi</th>
                      <th className="px-6 py-2 font-medium">Status</th>
                      <th className="px-6 py-2 text-right font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {karyawanList.map((karyawan) => (
                      <tr key={karyawan.id} className="group transition-all duration-300 hover:-translate-y-1 relative z-10">
                        <td className="px-6 py-5 bg-white rounded-l-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-l border-gray-100 group-hover:border-pilar-gold/40 transition-all">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 rounded-2xl bg-gray-50 overflow-hidden flex items-center justify-center font-black text-pilar-darker border border-gray-100 shadow-inner group-hover:border-pilar-gold/40 transition-colors">
                              {karyawan.foto ? (
                                <img src={karyawan.foto} alt={karyawan.nama} className="w-full h-full object-cover" />
                              ) : (
                                <span className="group-hover:text-pilar-gold transition-colors">
                                  {karyawan.nama.substring(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="font-extrabold text-gray-800 text-base">{karyawan.nama}</div>
                          </div>
                        </td>
                        
                        <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-gray-600 font-medium">
                          {karyawan.email}
                        </td>
                        
                        <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-gray-600">
                          <div className="flex items-center space-x-2">
                            <i className="fa-solid fa-briefcase text-gray-400"></i>
                            <span>{karyawan.posisi}</span>
                          </div>
                        </td>
                        
                        <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-gray-600">
                          <div className="flex items-center space-x-2">
                            <i className="fa-solid fa-map-pin text-gray-400"></i>
                            <span>{karyawan.lokasiId === "all" ? "Semua Cabang" : locations.find(l => l.id === karyawan.lokasiId)?.nama || "Tidak Diketahui"}</span>
                          </div>
                        </td>
                        
                        <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all">
                          <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm border
                            ${karyawan.status === "Aktif" ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`
                          }>
                            {karyawan.status}
                          </span>
                        </td>
                        
                        <td className="px-6 py-5 bg-white rounded-r-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-r border-gray-100 group-hover:border-pilar-gold/40 transition-all">
                          <div className="flex justify-end space-x-2">
                            <button 
                              onClick={() => {
                                setSelectedLaporanKaryawan(karyawan);
                                setIsLaporanModalOpen(true);
                              }} 
                              title="Lihat Laporan Absensi"
                              className="w-9 h-9 rounded-xl bg-gray-50 text-gray-500 hover:text-green-600 hover:bg-white border border-gray-100 hover:border-green-200 shadow-sm flex items-center justify-center transition-all"
                            >
                              <i className="fa-solid fa-file-signature text-sm"></i>
                            </button>
                            <button onClick={() => openEditModal(karyawan)} className="w-9 h-9 rounded-xl bg-gray-50 text-gray-500 hover:text-pilar-darker hover:bg-white border border-gray-100 hover:border-gray-200 shadow-sm flex items-center justify-center transition-all">
                              <i className="fa-solid fa-pen text-sm"></i>
                            </button>
                            <button onClick={() => handleDeleteKaryawan(karyawan.id)} className="w-9 h-9 rounded-xl bg-gray-50 text-gray-500 hover:text-red-500 hover:bg-white border border-gray-100 hover:border-red-100 shadow-sm flex items-center justify-center transition-all">
                              <i className="fa-solid fa-trash text-sm"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PENGGAJIAN TAB */}
          {activeMenu === "penggajian" && (
            <div className="space-y-8 animate-slide-up">
              
              {/* Summary Cards Penggajian */}
              {(() => {
                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                
                // Slip bulan ini
                const slipBulanIni = riwayatGaji.filter((s: any) => {
                  const d = s.createdAt ? new Date(s.createdAt) : new Date(s.tanggal);
                  return !isNaN(d.getTime()) && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
                });

                const totalGajiBulanIni = slipBulanIni.reduce((acc: number, curr: any) => acc + (Number(curr.gajiBersih) || 0), 0);
                const totalPotonganBpjsBulanIni = slipBulanIni.reduce((acc: number, curr: any) => acc + (Number(curr.potonganBpjsTk || 0) + Number(curr.potonganBpjsKes || 0)), 0);
                const uniquePaidEmployeeIds = new Set(slipBulanIni.map((s: any) => s.karyawanId));
                const jumlahKaryawanDibayar = Math.min(uniquePaidEmployeeIds.size, karyawanList.length);

                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Card 1: Total Gaji Dicairkan */}
                    <div className="group bg-white p-5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border border-gray-100/80 flex items-center space-x-3.5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-pilar-gold/5 rounded-full blur-2xl -mr-8 -mt-8 group-hover:bg-pilar-gold/15 transition-colors"></div>
                      <div className="w-12 h-12 bg-pilar-darker text-pilar-gold rounded-xl flex items-center justify-center text-xl shadow-md shadow-pilar-darker/10 group-hover:scale-105 transition-transform shrink-0 relative z-10">
                        <i className="fa-solid fa-money-bill-wave"></i>
                      </div>
                      <div className="min-w-0 relative z-10">
                        <p className="text-xs text-gray-500 font-medium truncate">Total Gaji Dicairkan (Bulan Ini)</p>
                        <p className="text-xl font-bold text-gray-800 tracking-tight mt-0.5 truncate">
                          Rp {new Intl.NumberFormat('id-ID').format(totalGajiBulanIni)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Card 2: Status Pembayaran */}
                    <div className="group bg-white p-5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border border-gray-100/80 flex items-center space-x-3.5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-pilar-gold/5 rounded-full blur-2xl -mr-8 -mt-8 group-hover:bg-pilar-gold/15 transition-colors"></div>
                      <div className="w-12 h-12 bg-pilar-gold text-pilar-darker rounded-xl flex items-center justify-center text-xl shadow-md shadow-pilar-gold/20 group-hover:scale-105 transition-transform shrink-0 relative z-10">
                        <i className="fa-solid fa-users-viewfinder"></i>
                      </div>
                      <div className="min-w-0 relative z-10">
                        <p className="text-xs text-gray-500 font-medium truncate">Status Pembayaran Bulan Ini</p>
                        <p className="text-xl font-bold text-gray-800 tracking-tight mt-0.5">
                          {jumlahKaryawanDibayar} / {karyawanList.length} Karyawan
                        </p>
                      </div>
                    </div>

                    {/* Card 3: Total BPJS */}
                    <div className="group bg-white p-5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border border-gray-100/80 flex items-center space-x-3.5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-pilar-gold/5 rounded-full blur-2xl -mr-8 -mt-8 group-hover:bg-pilar-gold/15 transition-colors"></div>
                      <div className="w-12 h-12 bg-pilar-darker text-pilar-gold rounded-xl flex items-center justify-center text-xl shadow-md shadow-pilar-darker/10 group-hover:scale-105 transition-transform shrink-0 relative z-10">
                        <i className="fa-solid fa-shield-halved"></i>
                      </div>
                      <div className="min-w-0 relative z-10">
                        <p className="text-xs text-gray-500 font-medium truncate">Total Iuran BPJS Terpotong</p>
                        <p className="text-xl font-bold text-gray-800 tracking-tight mt-0.5 truncate">
                          Rp {new Intl.NumberFormat('id-ID').format(totalPotonganBpjsBulanIni)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Graphic Chart Pengeluaran Gaji (Ringkas & Collapsible) */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100/80 transition-all">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-pilar-darker shrink-0">
                      <i className="fa-solid fa-chart-line text-sm text-pilar-gold"></i>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-gray-800 tracking-tight">Tren Pengeluaran Gaji Bulanan</h4>
                      <p className="text-[11px] text-gray-400">Total pencairan gaji bersih karyawan (Juta Rupiah)</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 self-end sm:self-center">
                    <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
                      <span className="w-2 h-2 rounded-full bg-pilar-darker"></span>
                      <span>Pengeluaran Gaji</span>
                    </div>

                    <button 
                      type="button"
                      onClick={() => setShowGajiChart(!showGajiChart)}
                      className="text-xs font-semibold text-gray-500 hover:text-pilar-darker hover:bg-gray-100 px-2.5 py-1 rounded-lg transition-colors flex items-center space-x-1.5 border border-transparent hover:border-gray-200"
                    >
                      <i className={`fa-solid ${showGajiChart ? "fa-chevron-up" : "fa-chevron-down"} text-[10px]`}></i>
                      <span>{showGajiChart ? "Sembunyikan" : "Tampilkan"}</span>
                    </button>
                  </div>
                </div>

                {showGajiChart && (
                  <div className="h-44 w-full mt-4 pt-2 border-t border-gray-50 animate-in fade-in duration-200">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dataGrafikGaji} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 11, fontWeight: 500}} dy={5} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 11, fontWeight: 500}} unit=" Jt" />
                        <Tooltip 
                          formatter={(value: any) => [`Rp ${new Intl.NumberFormat('id-ID').format(Math.round(Number(value) * 1000000))}`, "Total Gaji"]}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 20px -4px rgba(0, 0, 0, 0.1)', padding: '10px 14px', fontSize: '12px', fontWeight: 'bold' }} 
                        />
                        <Line type="monotone" dataKey="Pengeluaran" stroke="#00142f" strokeWidth={2.5} dot={{r: 3, fill: "#d4af37", strokeWidth: 1.5, stroke: "#00142f"}} activeDot={{r: 5, fill: "#d4af37"}} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Tab Navigasi Penggajian */}
              <div className="flex space-x-2 bg-gray-100 p-1.5 rounded-2xl w-fit">
                <button 
                  onClick={() => setActiveGajiTab("payroll")}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeGajiTab === "payroll" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Pencairan Gaji Karyawan (Payroll)
                </button>
                <button 
                  onClick={() => setActiveGajiTab("riwayat")}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeGajiTab === "riwayat" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Riwayat Pencairan Gaji
                </button>
              </div>

              {/* Tabel Perhitungan Payroll */}
              {activeGajiTab === "payroll" && (
                <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">Pencairan Gaji Karyawan (Payroll)</h3>
                    <p className="text-sm text-gray-500">Hitung potongan gaji otomatis berdasarkan absen alpa & potongan iuran BPJS.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center space-x-2 bg-white px-3.5 py-2 rounded-xl border border-gray-200 shadow-sm">
                      <span className="text-xs font-bold text-gray-600">Hari Kerja:</span>
                      <input 
                        type="number" 
                        value={workingDays} 
                        onChange={(e) => setWorkingDays(parseInt(e.target.value) || 1)}
                        className="w-14 border border-gray-300 rounded px-1.5 py-0.5 text-center font-bold text-sm focus:outline-none focus:border-pilar-gold focus:ring-1 focus:ring-pilar-gold"
                        min="1" max="31"
                      />
                      <span className="text-xs text-gray-500">Hari</span>
                    </div>

                    <div className="flex items-center space-x-2 bg-white px-3.5 py-2 rounded-xl border border-gray-200 shadow-sm">
                      <span className="text-xs font-bold text-gray-600">BPJS TK:</span>
                      <input 
                        type="number" 
                        step="0.1"
                        min="0"
                        max="100"
                        value={bpjsTkRate} 
                        onChange={(e) => handleUpdateBpjsTkRate(parseFloat(e.target.value))}
                        className="w-14 border border-gray-300 rounded px-1.5 py-0.5 text-center font-bold text-sm text-gray-800 focus:outline-none focus:border-pilar-gold focus:ring-1 focus:ring-pilar-gold"
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>

                    <div className="flex items-center space-x-2 bg-white px-3.5 py-2 rounded-xl border border-gray-200 shadow-sm">
                      <span className="text-xs font-bold text-gray-600">BPJS Kes:</span>
                      <input 
                        type="number" 
                        step="0.1"
                        min="0"
                        max="100"
                        value={bpjsKesRate} 
                        onChange={(e) => handleUpdateBpjsKesRate(parseFloat(e.target.value))}
                        className="w-14 border border-gray-300 rounded px-1.5 py-0.5 text-center font-bold text-sm text-gray-800 focus:outline-none focus:border-pilar-gold focus:ring-1 focus:ring-pilar-gold"
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                  </div>
                </div>
                
                <div className="overflow-x-auto p-6 -mt-2">
                  <table className="w-full text-left text-sm whitespace-nowrap border-separate" style={{borderSpacing: "0 16px"}}>
                    <thead>
                      <tr className="text-gray-500 font-semibold">
                        <th className="px-5 py-2 font-medium">Karyawan</th>
                        <th className="px-5 py-2 text-right font-medium">Gaji Pokok / Bln</th>
                        <th className="px-5 py-2 text-center font-medium">Hari Bolos (Alpa)</th>
                        <th className="px-5 py-2 text-right font-medium">Pot. Alpa</th>
                        <th className="px-5 py-2 text-right font-medium">BPJS TK ({bpjsTkRate}%)</th>
                        <th className="px-5 py-2 text-right font-medium">BPJS Kes ({bpjsKesRate}%)</th>
                        <th className="px-5 py-2 text-right font-medium">Gaji Bersih</th>
                        <th className="px-5 py-2 text-center font-medium">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {karyawanList.map((k) => {
                        const gajiPokok = k.gajiPokok || 0;
                        const nilaiPerHari = gajiPokok / workingDays;
                        
                        // Hitung otomatis Alpa dari data laporan absensi bulan & tahun yang dipilih
                        const jumlahBolos = riwayatLaporan.filter((l: any) => {
                          if (l.nama !== k.nama || l.status !== "Alpa" || !l.tanggal) return false;
                          const lDate = new Date(l.tanggal);
                          return !isNaN(lDate.getTime()) && 
                                 lDate.getMonth() + 1 === laporanBulan && 
                                 lDate.getFullYear() === laporanTahun;
                        }).length;
                        
                        const potonganAlpa = Math.round(jumlahBolos * nilaiPerHari);
                        const isIkutTk = k.bpjsTk !== false;
                        const isIkutKes = k.bpjsKes !== false;
                        const potBpjsTk = isIkutTk ? Math.round(gajiPokok * (bpjsTkRate / 100)) : 0;
                        const potBpjsKes = isIkutKes ? Math.round(gajiPokok * (bpjsKesRate / 100)) : 0;
                        const gajiBersih = Math.max(0, gajiPokok - potonganAlpa - potBpjsTk - potBpjsKes);

                        return (
                          <tr key={k.id} className="group transition-all duration-300 hover:-translate-y-1 relative z-10">
                            <td className="px-5 py-5 bg-white rounded-l-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-l border-gray-100 group-hover:border-pilar-gold/40 transition-all">
                              <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 rounded-2xl bg-gray-50 overflow-hidden flex items-center justify-center font-black text-pilar-darker border border-gray-100 shadow-inner group-hover:border-pilar-gold/40 transition-colors">
                                  {k.foto ? (
                                    <img src={k.foto} alt={k.nama} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="group-hover:text-pilar-gold transition-colors">
                                      {k.nama.substring(0, 2).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <div className="font-extrabold text-gray-800 text-base">{k.nama}</div>
                                  <div className="text-xs font-medium text-gray-500 flex items-center mt-0.5">
                                    <i className="fa-solid fa-briefcase mr-1.5 text-gray-400"></i> {k.posisi}
                                  </div>
                                </div>
                              </div>
                            </td>
                            
                            <td className="px-5 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-right font-bold text-gray-600">
                              Rp {new Intl.NumberFormat('id-ID').format(gajiPokok)}
                            </td>
                            
                            <td className="px-5 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-center">
                              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 font-bold text-gray-800 text-sm">
                                {jumlahBolos}
                              </span>
                            </td>
                            
                            <td className="px-5 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-right font-bold text-gray-500">
                              - Rp {new Intl.NumberFormat('id-ID').format(potonganAlpa)}
                            </td>

                            <td className="px-5 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-right font-bold text-gray-500">
                              {isIkutTk ? (
                                <span>- Rp {new Intl.NumberFormat('id-ID').format(potBpjsTk)}</span>
                              ) : (
                                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400 font-semibold inline-block">Nonaktif</span>
                              )}
                            </td>

                            <td className="px-5 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-right font-bold text-gray-500">
                              {isIkutKes ? (
                                <span>- Rp {new Intl.NumberFormat('id-ID').format(potBpjsKes)}</span>
                              ) : (
                                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400 font-semibold inline-block">Nonaktif</span>
                              )}
                            </td>
                            
                            <td className="px-5 py-5 bg-gray-50/50 shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-right font-black text-pilar-darker text-base">
                              Rp {new Intl.NumberFormat('id-ID').format(gajiBersih)}
                            </td>
                            
                            <td className="px-5 py-5 bg-white rounded-r-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-r border-gray-100 group-hover:border-pilar-gold/40 transition-all text-center">
                              <button 
                                onClick={() => handleBayarGaji(k.id, gajiBersih, k.nama, gajiPokok, potonganAlpa, jumlahBolos, potBpjsTk, potBpjsKes, bpjsTkRate, bpjsKesRate)}
                                disabled={gajiBersih <= 0}
                                className={`font-bold px-6 py-2.5 rounded-xl transition-all text-sm flex items-center justify-center mx-auto space-x-2 ${
                                  gajiBersih > 0 ? "bg-pilar-darker text-pilar-gold hover:bg-black shadow-md hover:shadow-lg focus:ring-4 focus:ring-pilar-darker/20" : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                                }`}
                              >
                                <i className="fa-solid fa-hand-holding-dollar"></i>
                                <span>Bayar</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              )}

              {/* Riwayat Slip Gaji */}
              {activeGajiTab === "riwayat" && (
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row md:justify-between md:items-center bg-gray-50/50 gap-4">
                  <div>
                    <h3 className="font-extrabold text-gray-800 text-xl tracking-tight">Riwayat Pencairan Gaji</h3>
                    <p className="text-sm text-gray-500">Daftar slip gaji karyawan yang telah berhasil dicairkan.</p>
                  </div>
                  <button 
                    onClick={handleExportGaji}
                    className="bg-pilar-darker hover:bg-black text-pilar-gold font-bold px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg focus:ring-4 focus:ring-pilar-darker/20 transition-all flex items-center justify-center"
                  >
                    <span>Export Excel</span>
                  </button>
                </div>
                
                <div className="overflow-x-auto p-6 -mt-2">
                  <table className="w-full text-left text-sm whitespace-nowrap border-separate" style={{borderSpacing: "0 14px"}}>
                    <thead>
                      <tr className="text-gray-500 font-semibold">
                        <th className="px-5 py-2 font-medium">ID Slip</th>
                        <th className="px-5 py-2 font-medium">Tanggal</th>
                        <th className="px-5 py-2 font-medium">Karyawan</th>
                        <th className="px-5 py-2 text-right font-medium">Gaji Pokok</th>
                        <th className="px-5 py-2 text-right font-medium">Potongan</th>
                        <th className="px-5 py-2 text-right font-medium">Gaji Bersih</th>
                        <th className="px-5 py-2 text-center font-medium">Status</th>
                        <th className="px-5 py-2 text-center font-medium">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riwayatGaji.length > 0 ? (
                        riwayatGaji.map((slip: any) => (
                          <tr key={slip.id} className="group transition-all duration-300 hover:-translate-y-0.5 relative z-10">
                            <td className="px-5 py-4 bg-white rounded-l-2xl shadow-sm border-y border-l border-gray-100 font-mono text-xs text-gray-500">
                              {slip.id}
                            </td>
                            <td className="px-5 py-4 bg-white shadow-sm border-y border-gray-100 text-gray-600 font-medium">
                              <div className="flex items-center space-x-2">
                                <i className="fa-solid fa-calendar-day text-gray-400 text-xs"></i>
                                <span>{slip.tanggal}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4 bg-white shadow-sm border-y border-gray-100 font-bold text-gray-800">
                              {slip.nama}
                            </td>
                            <td className="px-5 py-4 bg-white shadow-sm border-y border-gray-100 text-right font-semibold text-gray-600">
                              Rp {new Intl.NumberFormat('id-ID').format(slip.gajiPokok || 0)}
                            </td>
                            <td className="px-5 py-4 bg-white shadow-sm border-y border-gray-100 text-right font-semibold text-red-500">
                              - Rp {new Intl.NumberFormat('id-ID').format(slip.potongan || 0)}
                            </td>
                            <td className="px-5 py-4 bg-gray-50/50 shadow-sm border-y border-gray-100 text-right font-black text-pilar-darker">
                              Rp {new Intl.NumberFormat('id-ID').format(slip.gajiBersih || 0)}
                            </td>
                            <td className="px-5 py-4 bg-white shadow-sm border-y border-gray-100 text-center">
                              <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Berhasil
                              </span>
                            </td>
                            <td className="px-5 py-4 bg-white rounded-r-2xl shadow-sm border-y border-r border-gray-100 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedAdminSlip(slip)}
                                className="w-8 h-8 rounded-xl bg-gray-50 text-gray-500 hover:text-pilar-darker hover:bg-pilar-gold/20 flex items-center justify-center transition-all mx-auto border border-gray-100 shadow-sm"
                                title="Lihat Slip Gaji"
                              >
                                <i className="fa-solid fa-file-invoice text-xs"></i>
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                            Belum ada riwayat pencairan gaji.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              )}

            </div>
          )}

          {/* PENGATURAN TAB */}
          {activeMenu === "pengaturan" && (
            <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60 overflow-hidden animate-slide-up">
              <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row md:justify-between md:items-center bg-gray-50/50 space-y-4 md:space-y-0">
                <div>
                  <h3 className="font-extrabold text-gray-800 text-xl tracking-tight">Konfigurasi Titik Lokasi Absensi (GPS)</h3>
                  <p className="text-sm text-gray-500 mt-1">Atur berbagai cabang perusahaan dan radius toleransi absensi.</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingLocationId(null);
                    setFormLokasiNama("");
                    setOfficeLat("-6.200000");
                    setOfficeLng("106.816666");
                    setOfficeRadius("50");
                    setIsLocationModalOpen(true);
                  }}
                  className="w-full md:w-auto bg-pilar-darker hover:bg-black text-pilar-gold font-bold px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg focus:ring-4 focus:ring-pilar-darker/20 transition-all flex items-center justify-center"
                >
                  <span>Tambah Lokasi</span>
                </button>
              </div>
              
              <div className="p-8 bg-gray-50/30 min-h-[500px]">
                <div className="overflow-x-auto -mt-2">
                  <table className="w-full text-left text-sm whitespace-nowrap border-separate" style={{borderSpacing: "0 16px"}}>
                    <thead>
                      <tr className="text-gray-500 font-semibold">
                        <th className="px-6 py-2 font-medium">Nama Cabang / Lokasi</th>
                        <th className="px-6 py-2 font-medium">Koordinat (Lat, Lng)</th>
                        <th className="px-6 py-2 font-medium text-center">Radius Toleransi</th>
                        <th className="px-6 py-2 font-medium text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locations.map(loc => (
                        <tr key={loc.id} className="group transition-all duration-300 hover:-translate-y-1 relative z-10">
                          <td className="px-6 py-5 bg-white rounded-l-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-l border-gray-100 group-hover:border-pilar-gold/40 transition-all">
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-xl text-pilar-darker border border-gray-100 shadow-inner group-hover:bg-pilar-darker group-hover:text-pilar-gold transition-colors">
                                <i className="fa-solid fa-building"></i>
                              </div>
                              <div className="font-extrabold text-gray-800 text-base group-hover:text-pilar-darker transition-colors">{loc.nama}</div>
                            </div>
                          </td>
                          
                          <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-gray-600">
                            <span className="flex items-center"><i className="fa-solid fa-location-dot text-gray-400 mr-2"></i> <span className="font-mono">{loc.lat}, {loc.lng}</span></span>
                          </td>
                          
                          <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-center">
                            <span className="inline-flex items-center justify-center px-4 py-1.5 rounded-full text-xs font-bold bg-gray-50 text-gray-600 border border-gray-200">
                              <i className="fa-solid fa-circle-notch text-pilar-gold mr-1.5"></i> {loc.radius} m
                            </span>
                          </td>
                          
                          <td className="px-6 py-5 bg-white rounded-r-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-r border-gray-100 group-hover:border-pilar-gold/40 transition-all">
                            <div className="flex justify-center space-x-2">
                              <button 
                                onClick={() => {
                                  setEditingLocationId(loc.id);
                                  setFormLokasiNama(loc.nama);
                                  setOfficeLat(loc.lat.toString());
                                  setOfficeLng(loc.lng.toString());
                                  setOfficeRadius(loc.radius.toString());
                                  setIsLocationModalOpen(true);
                                }}
                                className="w-9 h-9 rounded-xl bg-gray-50 text-gray-500 hover:text-pilar-darker hover:bg-white border border-gray-100 hover:border-gray-200 shadow-sm flex items-center justify-center transition-all"
                              >
                                <i className="fa-solid fa-pen text-sm"></i>
                              </button>
                              <button 
                                onClick={() => handleDeleteLocation(loc.id)}
                                className="w-9 h-9 rounded-xl bg-gray-50 text-gray-500 hover:text-red-500 hover:bg-white border border-gray-100 hover:border-gray-200 shadow-sm flex items-center justify-center transition-all"
                              >
                                <i className="fa-solid fa-trash text-sm"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {locations.length === 0 && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-200 hover:border-pilar-gold/50 rounded-[2rem] bg-white transition-colors">
                      <div className="bg-gray-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <i className="fa-solid fa-map-location-dot text-4xl text-gray-300"></i>
                      </div>
                      <p className="text-gray-800 font-extrabold text-xl tracking-tight">Belum ada lokasi absen terdaftar.</p>
                      <p className="text-gray-500 text-sm mt-2 mb-8 max-w-md mx-auto">Klik "Tambah Lokasi" untuk mulai mengatur batas koordinat dan radius cabang perusahaan Anda.</p>
                      <button 
                        onClick={() => {
                          setEditingLocationId(null);
                          setFormLokasiNama("");
                          setIsLocationModalOpen(true);
                        }}
                        className="bg-pilar-darker text-pilar-gold px-8 py-3 rounded-xl font-bold shadow-md hover:bg-black transition focus:ring-4 focus:ring-pilar-darker/20"
                      >
                        <i className="fa-solid fa-plus mr-2"></i> Tambah Lokasi Baru
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL LOKASI */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-gray-50 rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-gray-100 bg-white flex justify-between items-center shadow-sm z-10 shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-pilar-gold/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
              <h3 className="font-extrabold text-gray-900 text-xl tracking-tight relative z-10">
                {editingLocationId ? `Edit Lokasi: ${formLokasiNama}` : "Tambah Lokasi Baru"}
              </h3>
              <button onClick={() => setIsLocationModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center relative z-10">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {/* Form Fields - Structured Layout */}
              <div className="p-5 bg-white border-b border-gray-100 flex flex-col space-y-4 z-10">
                {/* Baris 1: Nama Lokasi & Radius */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Nama Lokasi (Cabang/Proyek)</label>
                    <input 
                      type="text" 
                      value={formLokasiNama} 
                      onChange={(e) => setFormLokasiNama(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker text-sm shadow-sm transition-all"
                      placeholder="Misal: Kantor Pusat"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Radius Toleransi</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={officeRadius} 
                        onChange={(e) => setOfficeRadius(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl pl-4 pr-12 py-2 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker text-sm shadow-sm transition-all font-bold text-gray-900"
                      />
                      <span className="absolute right-4 top-2 text-gray-400 text-sm font-bold">m</span>
                    </div>
                  </div>
                </div>

                {/* Baris 2: Koordinat */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-bold text-gray-700">Koordinat (Lat, Lng)</label>
                    <button 
                      type="button" 
                      onClick={() => {
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (position) => {
                              setOfficeLat(position.coords.latitude.toFixed(6));
                              setOfficeLng(position.coords.longitude.toFixed(6));
                            },
                            (error) => {
                              alert("Gagal mendapatkan lokasi: " + error.message);
                            },
                            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                          );
                        } else {
                          alert("Geolokasi tidak didukung oleh browser Anda.");
                        }
                      }}
                      className="text-xs text-pilar-gold font-bold hover:text-pilar-darker transition-colors bg-gray-50 px-2 py-1 rounded-md border border-gray-200 flex items-center space-x-1 shadow-sm"
                    >
                      <i className="fa-solid fa-location-crosshairs"></i> 
                      <span>Lokasi Saat Ini</span>
                    </button>
                  </div>
                  <div className="flex border border-gray-200 rounded-xl overflow-hidden focus-within:border-pilar-darker focus-within:ring-1 focus-within:ring-pilar-darker text-sm bg-white shadow-sm transition-all">
                    <input type="text" value={officeLat} onChange={(e) => setOfficeLat(e.target.value)} className="w-1/2 px-2 py-2 focus:outline-none border-r border-gray-200 text-center font-mono font-bold text-gray-800" placeholder="Lat" />
                    <input type="text" value={officeLng} onChange={(e) => setOfficeLng(e.target.value)} className="w-1/2 px-2 py-2 focus:outline-none text-center font-mono font-bold text-gray-800" placeholder="Lng" />
                  </div>
                  <div className="mt-3">
                    <div className="flex border border-gray-200 rounded-xl overflow-hidden focus-within:border-pilar-darker focus-within:ring-1 focus-within:ring-pilar-darker text-sm bg-white shadow-sm transition-all">
                      <div className="bg-gray-50 px-3 flex items-center justify-center text-gray-400 border-r border-gray-200">
                        <i className="fa-solid fa-link"></i>
                      </div>
                      <input 
                        type="text" 
                        placeholder="Atau Paste Link Google Maps panjang di sini..." 
                        className="w-full px-3 py-2 focus:outline-none text-gray-700 text-xs"
                        onChange={(e) => {
                          const link = e.target.value;
                          if (!link) return;
                          
                          const atMatch = link.match(new RegExp('@(-?\\d+\\.\\d+),(-?\\d+\\.\\d+)'));
                          if (atMatch) {
                            setOfficeLat(atMatch[1]);
                            setOfficeLng(atMatch[2]);
                            showToast("Berhasil mengambil koordinat dari Link Google Maps!");
                            return;
                          }
                          
                          const qMatch = link.match(new RegExp('[?&](?:q|query)=(-?\\d+\\.\\d+),(-?\\d+\\.\\d+)'));
                          if (qMatch) {
                            setOfficeLat(qMatch[1]);
                            setOfficeLng(qMatch[2]);
                            showToast("Berhasil mengambil koordinat dari Link Google Maps!");
                            return;
                          }

                          const searchMatch = link.match(new RegExp('\\/search\\/(-?\\d+\\.\\d+),(-?\\d+\\.\\d+)'));
                          if (searchMatch) {
                            setOfficeLat(searchMatch[1]);
                            setOfficeLng(searchMatch[2]);
                            showToast("Berhasil mengambil koordinat dari Link Google Maps!");
                            return;
                          }
                          
                          showToast("Gagal mengambil koordinat. Pastikan Anda menyalin URL lengkap dari address bar browser, bukan link pendek (goo.gl).");
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

            {/* Large Map Area */}
            <div className="relative z-0 p-5 bg-gray-50/50">
              <div className="w-full h-[280px] rounded-2xl overflow-hidden shadow-sm border border-gray-200">
                <MapSelector 
                  lat={parseFloat(officeLat) || -6.200000} 
                  lng={parseFloat(officeLng) || 106.816666} 
                  radius={parseFloat(officeRadius) || 50} 
                  onLocationSelect={(lat, lng) => {
                    setOfficeLat(lat.toFixed(6));
                    setOfficeLng(lng.toFixed(6));
                  }}
                />
              </div>
            </div>
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-5 border-t border-gray-100 bg-white flex justify-end space-x-3 shrink-0">
              <button onClick={() => setIsLocationModalOpen(false)} className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors">
                Batal
              </button>
              <button onClick={handleSaveLocation} className="bg-pilar-darker text-pilar-gold font-bold px-8 py-3 rounded-xl shadow-md hover:bg-black hover:shadow-lg focus:ring-4 focus:ring-pilar-darker/20 transition-all flex items-center space-x-2">
                <i className="fa-solid fa-save"></i>
                <span>Simpan Lokasi</span>
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            
            <div className="p-8 text-center relative z-10">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-100 shadow-inner">
                <i className="fa-solid fa-triangle-exclamation text-4xl"></i>
              </div>
              <h3 className="font-extrabold text-gray-900 text-2xl tracking-tight mb-2">Konfirmasi Tindakan</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{confirmModal.message}</p>
            </div>
            <div className="bg-gray-50/80 px-8 py-5 flex space-x-3 justify-center border-t border-gray-100 relative z-10">
              <button 
                onClick={() => setConfirmModal(null)} 
                className="px-5 py-3 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors w-1/2"
              >
                Batal
              </button>
              <button 
                onClick={confirmModal.onConfirm} 
                className="px-5 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-md hover:shadow-lg focus:ring-4 focus:ring-red-600/20 w-1/2"
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 relative">
            <div className="p-8 text-center relative z-10">
              <h3 className="font-extrabold text-gray-900 text-xl tracking-tight mb-4">Kembalikan untuk Direvisi</h3>
              <p className="text-gray-500 text-sm mb-4">Berikan alasan mengapa pengajuan ini tidak disetujui atau dokumen apa yang masih kurang.</p>
              <textarea 
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Misal: Mohon lampirkan surat dokter yang asli / foto lebih jelas..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker text-sm shadow-sm transition-all min-h-[100px] resize-none"
              ></textarea>
            </div>
            <div className="bg-gray-50/80 px-8 py-5 flex space-x-3 justify-end border-t border-gray-100 relative z-10">
              <button 
                onClick={() => setRejectModalOpen(false)} 
                className="px-5 py-3 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleRejectSubmit} 
                className="px-5 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-md hover:shadow-lg focus:ring-4 focus:ring-red-600/20"
              >
                Kirim Revisi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Pengajuan Modal */}
      {detailModalOpen && selectedPengajuan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex print:block print:p-0 items-center justify-center z-[200] p-4 animate-fade-in">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col print:max-w-none print:w-full print:h-full print:rounded-none print:shadow-none print:overflow-visible animate-in zoom-in-95 duration-200 relative">
            
            {/* Header Actions (On Screen Only) */}
            <div className="print:hidden flex justify-between items-center p-6 pb-4 border-b border-gray-200 bg-white rounded-t-3xl z-10">
              <div className="flex items-center space-x-2">
                <i className="fa-solid fa-file-signature text-pilar-gold text-lg"></i>
                <span className="font-bold text-gray-800 text-sm md:text-base">Detail Dokumen Pengajuan</span>
              </div>
              <div className="flex items-center space-x-4">
                {selectedPengajuan.status === "Disetujui" && (
                  <button 
                    onClick={() => {
                      const originalTitle = document.title;
                      const dateStr = selectedPengajuan.createdAt 
                        ? new Date(selectedPengajuan.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) 
                        : "";
                      document.title = `${selectedPengajuan.karyawanNama}_${selectedPengajuan.type}_${dateStr}`;
                      setTimeout(() => {
                        window.print();
                        document.title = originalTitle;
                      }, 50);
                    }} 
                    className="flex items-center space-x-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors"
                  >
                    <i className="fa-solid fa-print"></i> <span>Cetak / PDF</span>
                  </button>
                )}
                <button 
                  onClick={() => setDetailModalOpen(false)} 
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>
            </div>
            {/* Content (Scrollable on screen, Full on Print) */}
            <div id="print-section" className="overflow-y-auto p-8 md:p-10 text-black font-sans bg-white print:p-0 print:overflow-visible flex-1 relative" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              {/* KOP SURAT PERUSAHAAN */}
              <div className="hidden print:flex items-center justify-between border-b-2 border-pilar-darker pb-4 mb-6">
                <div className="flex items-center space-x-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src="https://res.cloudinary.com/sgcxykbd/image/upload/v1788834500/logo_horizontal_2.png" 
                    alt="Logo PT. Pilar Sentra Solusi" 
                    className="h-14 object-contain" 
                  />
                </div>
                <div className="text-right">
                  <h1 className="text-xl font-black tracking-tight text-pilar-darker uppercase">PT. PILAR SENTRA SOLUSI</h1>
                  <p className="text-xs text-gray-600 font-semibold">General Contractor & IT Solutions</p>
                  <p className="text-[11px] text-gray-500">Grand Slipi Tower Lt. 9, Jakarta Barat 11480 | info@pilarsentrasolusi.com</p>
                </div>
              </div>

              {/* JUDUL FORMULIR */}
              <div className="hidden print:block text-center my-6">
                <h2 className="text-lg font-black uppercase tracking-wider text-pilar-darker border-b-2 border-pilar-gold inline-block pb-1">
                  FORMULIR PENGAJUAN CUTI & IZIN KARYAWAN
                </h2>
                <p className="text-xs text-gray-500 mt-1">Dokumen Resmi Pengajuan Ketidakhadiran</p>
              </div>

              {/* INFORMASI PEGAWAI */}
              <div className="mb-6">
                <div className="bg-pilar-darker text-pilar-gold font-bold px-4 py-2 text-xs uppercase tracking-wider rounded-t-xl">
                  A. Informasi Pegawai
                </div>
                <div className="border border-gray-300 border-t-0 rounded-b-xl p-4 grid grid-cols-2 gap-4 text-xs bg-gray-50/50">
                  <div className="space-y-2">
                    <div className="grid grid-cols-[120px_auto_1fr] gap-2 border-b border-gray-200 pb-1.5">
                      <span className="text-gray-600 font-medium">Nama Lengkap</span>
                      <span className="text-gray-400">:</span>
                      <span className="font-bold text-gray-900 uppercase">{selectedPengajuan.karyawanNama}</span>
                    </div>
                    <div className="grid grid-cols-[120px_auto_1fr] gap-2 border-b border-gray-200 pb-1.5">
                      <span className="text-gray-600 font-medium">Jabatan / Posisi</span>
                      <span className="text-gray-400">:</span>
                      <span className="font-bold text-gray-900">{selectedPengajuan.karyawanPosisi}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-[120px_auto_1fr] gap-2 border-b border-gray-200 pb-1.5">
                      <span className="text-gray-600 font-medium">No. Induk (NIK)</span>
                      <span className="text-gray-400">:</span>
                      <span className="font-mono font-bold text-gray-800">
                        {(() => {
                          const emp = karyawanList.find(k => k.id === selectedPengajuan.karyawanId || k.nama === selectedPengajuan.karyawanNama);
                          return emp?.noInduk || "-";
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* DETAIL CUTI & IZIN */}
              <div className="mb-6">
                <div className="bg-pilar-darker text-pilar-gold font-bold px-4 py-2 text-xs uppercase tracking-wider rounded-t-xl">
                  B. Detail Pengajuan
                </div>
                <div className="border border-gray-300 border-t-0 rounded-b-xl p-4 text-xs bg-white">
                  <div className="font-bold text-gray-800 mb-2.5">Kategori / Jenis Pengajuan:</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-4 mb-5 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    {["Cuti Tahunan", "Cuti Sakit", "Cuti Melahirkan", "Cuti Lembur", "Cuti Haid", "Cuti Khusus", "Cuti Tanpa Bayar", "Izin Pribadi"].map((jenis) => (
                      <div key={jenis} className="flex items-center gap-2.5">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center font-bold text-xs ${selectedPengajuan.type.includes(jenis.split(' ')[1]) || (selectedPengajuan.type === 'Cuti Khusus' && jenis === 'Cuti Khusus') ? 'bg-pilar-darker border-pilar-darker text-pilar-gold' : 'border-gray-400 bg-white'}`}>
                          {(selectedPengajuan.type.includes(jenis.split(' ')[1]) || (selectedPengajuan.type === 'Cuti Khusus' && jenis === 'Cuti Khusus')) ? "✓" : ""}
                        </div>
                        <span className={(selectedPengajuan.type.includes(jenis.split(' ')[1]) || (selectedPengajuan.type === 'Cuti Khusus' && jenis === 'Cuti Khusus')) ? "font-bold text-gray-900" : "text-gray-600"}>
                          {jenis}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="grid grid-cols-[130px_auto_1fr] gap-2 border-b border-gray-100 pb-1.5">
                        <span className="text-gray-600 font-medium">Tanggal Mulai</span>
                        <span className="text-gray-400">:</span>
                        <span className="font-bold text-gray-900">{selectedPengajuan.startDate}</span>
                      </div>
                      <div className="grid grid-cols-[130px_auto_1fr] gap-2 border-b border-gray-100 pb-1.5">
                        <span className="text-gray-600 font-medium">Tanggal Selesai</span>
                        <span className="text-gray-400">:</span>
                        <span className="font-bold text-gray-900">{selectedPengajuan.endDate}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="grid grid-cols-[130px_auto_1fr] gap-2 border-b border-gray-100 pb-1.5">
                        <span className="text-gray-600 font-medium">Durasi (Hari Kerja)</span>
                        <span className="text-gray-400">:</span>
                        <span className="font-bold text-gray-900">{selectedPengajuan.duration} Hari</span>
                      </div>
                      <div className="grid grid-cols-[130px_auto_1fr] gap-2 border-b border-gray-100 pb-1.5">
                        <span className="text-gray-600 font-medium">Tanggal Pengajuan</span>
                        <span className="text-gray-400">:</span>
                        <span className="text-gray-900">{selectedPengajuan.createdAt ? new Date(selectedPengajuan.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : "-"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* KETERANGAN & PELIMPAHAN TUGAS */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="border border-gray-300 rounded-xl overflow-hidden">
                  <div className="bg-gray-100 border-b border-gray-300 font-bold px-4 py-2 text-xs text-gray-700 uppercase tracking-wider">
                    C. Keterangan / Alasan
                  </div>
                  <div className="p-4 space-y-3 text-xs bg-white min-h-[100px]">
                    <div>
                      <span className="block text-gray-500 mb-1 font-medium">Alasan Pengajuan:</span>
                      <span className="font-bold text-gray-900 block bg-gray-50 p-2 rounded border border-gray-100">
                        {selectedPengajuan.reason}
                      </span>
                    </div>
                    <div>
                      <span className="block text-gray-500 mb-1 font-medium">Catatan / Detail:</span>
                      <span className="text-gray-800 italic block border-b border-dashed border-gray-300 pb-1">
                        {selectedPengajuan.additionalNotes || "-"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="border border-gray-300 rounded-xl overflow-hidden">
                  <div className="bg-gray-100 border-b border-gray-300 font-bold px-4 py-2 text-xs text-gray-700 uppercase tracking-wider">
                    D. Pelimpahan Tugas
                  </div>
                  <div className="p-4 space-y-3 text-xs bg-white min-h-[100px]">
                    <div className="grid grid-cols-[80px_auto_1fr] gap-2 border-b border-gray-100 pb-1.5">
                      <span className="text-gray-500 font-medium">Nama</span>
                      <span className="text-gray-400">:</span>
                      <span className="font-bold text-gray-900">{selectedPengajuan.delegationName || "__________________"}</span>
                    </div>
                    <div className="grid grid-cols-[80px_auto_1fr] gap-2 border-b border-gray-100 pb-1.5">
                      <span className="text-gray-500 font-medium">Jabatan</span>
                      <span className="text-gray-400">:</span>
                      <span className="font-medium text-gray-800">{selectedPengajuan.delegationRole || "__________________"}</span>
                    </div>
                    <div className="mt-4 pt-2 text-[10px] text-gray-400 leading-tight">
                      *Dengan ini penerima wewenang bersedia mengambil alih tanggung jawab pekerjaan selama pemohon tidak hadir.
                    </div>
                  </div>
                </div>
              </div>

              {/* TANDA TANGAN */}
              <div className="hidden print:grid grid-cols-3 gap-6 text-center text-xs mt-10">
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <p className="text-gray-600 font-medium mb-1">Diajukan Oleh,</p>
                    <p className="text-[10px] text-gray-400 mb-16">Tanggal: {selectedPengajuan.createdAt ? new Date(selectedPengajuan.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : "__________________"}</p>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 border-b border-gray-400 pb-1 mx-auto w-4/5 uppercase">
                      {selectedPengajuan.karyawanNama}
                    </p>
                    <p className="text-gray-500 mt-1">{selectedPengajuan.karyawanPosisi}</p>
                  </div>
                </div>
                
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <p className="text-gray-600 font-medium mb-1">Penerima Pelimpahan Tugas,</p>
                    <p className="text-[10px] text-gray-400 mb-16">Tanggal: __________________</p>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 border-b border-gray-400 pb-1 mx-auto w-4/5">
                      {selectedPengajuan.delegationName || "__________________"}
                    </p>
                    <p className="text-gray-500 mt-1">{selectedPengajuan.delegationRole || "__________________"}</p>
                  </div>
                </div>

                <div className="flex flex-col h-full justify-between">
                  <div>
                    <p className="text-gray-600 font-medium mb-1">Disetujui / Disahkan Oleh,</p>
                    <p className="text-[10px] text-gray-400 mb-16">Tanggal: {selectedPengajuan.status === "Disetujui" ? new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : "__________________"}</p>
                  </div>
                  <div className="relative">
                    {selectedPengajuan.status === "Disetujui" && (
                      <div className="absolute top-[-50px] left-1/2 transform -translate-x-1/2 border-4 border-emerald-600 text-emerald-600 font-black text-xs px-2 py-1 rotate-[-15deg] opacity-70 uppercase tracking-widest rounded">
                        APPROVED
                      </div>
                    )}
                    {selectedPengajuan.status === "Ditolak" && (
                      <div className="absolute top-[-50px] left-1/2 transform -translate-x-1/2 border-4 border-red-600 text-red-600 font-black text-xs px-2 py-1 rotate-[-15deg] opacity-70 uppercase tracking-widest rounded">
                        REJECTED
                      </div>
                    )}
                    <p className="font-bold text-gray-900 border-b border-gray-400 pb-1 mx-auto w-4/5">
                      PT. PILAR SENTRA SOLUSI
                    </p>
                    <p className="text-gray-500 mt-1">HR Manager / Direktur</p>
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <div className="hidden print:block mt-14 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400 italic">
                Dokumen ini merupakan formulir pengajuan resmi yang dicetak melalui Sistem Absensi PT. Pilar Sentra Solusi.
              </div>
            </div>

            {/* Bottom Actions for Pending (On Screen Only) */}
            {selectedPengajuan.status === "Menunggu" && (
              <div className="print:hidden p-5 bg-white border-t border-gray-200 flex justify-end space-x-4 rounded-b-3xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 relative">
                <button 
                  onClick={() => {
                    setDetailModalOpen(false);
                    openRejectModal(selectedPengajuan.id);
                  }} 
                  className="px-6 py-2.5 rounded-xl border-2 border-red-200 text-red-600 font-bold hover:bg-red-50 hover:text-red-700 transition-all focus:ring-4 focus:ring-red-100"
                >
                  Tolak
                </button>
                <button 
                  onClick={() => {
                    setDetailModalOpen(false);
                    handleApprove(selectedPengajuan.id);
                  }} 
                  className="px-8 py-2.5 rounded-xl bg-pilar-darker text-pilar-gold font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all focus:ring-4 focus:ring-pilar-darker/30"
                >
                  Setujui
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* MODAL SLIP GAJI DI ADMIN */}
      {/* MODAL SLIP GAJI RESMI ADMIN */}
      {selectedAdminSlip && (
        <div className="fixed inset-0 z-50 bg-gray-900/90 backdrop-blur-sm flex justify-center overflow-y-auto p-2 sm:p-8 animate-in fade-in pb-safe">
          <div 
            id="print-section" 
            className="bg-white text-black font-sans p-6 sm:p-10 md:p-12 w-full max-w-4xl shadow-2xl sm:my-auto my-0 min-h-screen sm:min-h-0 sm:rounded-3xl relative" 
            style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
          >
            {/* CUSTOM HEADER MODAL (Hidden on Print) */}
            <div className="print:hidden flex justify-between items-center pb-4 mb-6 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <i className="fa-solid fa-file-signature text-pilar-gold text-lg"></i>
                <span className="font-bold text-gray-800 text-sm md:text-base">Detail Slip Gaji</span>
              </div>
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => window.print()} 
                  className="flex items-center space-x-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors"
                >
                  <i className="fa-solid fa-print"></i> <span>Cetak / PDF</span>
                </button>
                <button 
                  onClick={() => setSelectedAdminSlip(null)} 
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>
            </div>
            {/* KOP SURAT PERUSAHAAN */}
            <div className="hidden print:flex items-center justify-between border-b-2 border-pilar-darker pb-4 mb-6">
              <div className="flex items-center space-x-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src="https://res.cloudinary.com/sgcxykbd/image/upload/v1788834500/logo_horizontal_2.png" 
                  alt="Logo PT. Pilar Sentra Solusi" 
                  className="h-14 object-contain" 
                />
              </div>
              <div className="text-right">
                <h1 className="text-xl font-black tracking-tight text-pilar-darker uppercase">PT. PILAR SENTRA SOLUSI</h1>
                <p className="text-xs text-gray-600 font-semibold">General Contractor & IT Solutions</p>
                <p className="text-[11px] text-gray-500">Grand Slipi Tower Lt. 9, Jakarta Barat 11480 | info@pilarsentrasolusi.com</p>
              </div>
            </div>

            {/* JUDUL SLIP GAJI */}
            <div className="hidden print:block text-center my-6">
              <h2 className="text-lg font-black uppercase tracking-wider text-pilar-darker border-b-2 border-pilar-gold inline-block pb-1">
                SLIP GAJI KARYAWAN (CONFIDENTIAL PAYSLIP)
              </h2>
              <p className="text-xs text-gray-500 mt-1">Bukti Resmi Pembayaran Gaji Karyawan</p>
            </div>

            {/* METADATA KARYAWAN & TRANSAKSI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 p-4 rounded-xl border border-gray-300 bg-gray-50/70 text-xs">
              <div className="space-y-2">
                <div className="grid grid-cols-[120px_auto_1fr] gap-2">
                  <span className="text-gray-600 font-medium">Nama Karyawan</span>
                  <span className="text-gray-400">:</span>
                  <span className="font-bold text-gray-900 uppercase">{selectedAdminSlip.nama}</span>
                </div>
                <div className="grid grid-cols-[120px_auto_1fr] gap-2">
                  <span className="text-gray-600 font-medium">Nomor Slip</span>
                  <span className="text-gray-400">:</span>
                  <span className="font-mono font-bold text-gray-800">{selectedAdminSlip.id}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-[120px_auto_1fr] gap-2">
                  <span className="text-gray-600 font-medium">Tanggal Pencairan</span>
                  <span className="text-gray-400">:</span>
                  <span className="font-bold text-gray-900">{selectedAdminSlip.tanggal}</span>
                </div>
                <div className="grid grid-cols-[120px_auto_1fr] gap-2">
                  <span className="text-gray-600 font-medium">Status Pembayaran</span>
                  <span className="text-gray-400">:</span>
                  <span className="font-extrabold text-emerald-700">LUNAS / BERHASIL DITRANSFER</span>
                </div>
              </div>
            </div>

            {/* TABEL PENGHASILAN & POTONGAN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              {/* Kolom Kiri: Penghasilan */}
              <div className="border border-gray-300 rounded-xl overflow-hidden">
                <div className="bg-pilar-darker text-pilar-gold font-bold px-4 py-2.5 text-xs uppercase tracking-wider flex justify-between items-center">
                  <span>A. Penghasilan (Earnings)</span>
                  <i className="fa-solid fa-circle-plus text-xs"></i>
                </div>
                <div className="p-4 space-y-3 text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-200">
                    <span className="text-gray-700">Gaji Pokok</span>
                    <span className="font-bold text-gray-900">
                      Rp {new Intl.NumberFormat('id-ID').format(selectedAdminSlip.gajiPokok || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100 text-gray-400">
                    <span>Tunjangan Operasional</span>
                    <span>Rp 0</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-300 font-extrabold text-gray-900 text-sm">
                    <span>Total Penghasilan (A)</span>
                    <span className="text-pilar-darker">
                      Rp {new Intl.NumberFormat('id-ID').format(selectedAdminSlip.gajiPokok || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Kolom Kanan: Potongan */}
              <div className="border border-gray-300 rounded-xl overflow-hidden">
                <div className="bg-pilar-darker text-pilar-gold font-bold px-4 py-2.5 text-xs uppercase tracking-wider flex justify-between items-center">
                  <span>B. Potongan (Deductions)</span>
                  <i className="fa-solid fa-circle-minus text-xs"></i>
                </div>
                <div className="p-4 space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-gray-100">
                    <span className="text-gray-700">Potongan Alpa ({selectedAdminSlip.alpa || 0} Hari)</span>
                    <span className={(selectedAdminSlip.potonganAlpa || 0) > 0 ? "font-bold text-red-600" : "text-gray-500"}>
                      {(selectedAdminSlip.potonganAlpa || 0) > 0 
                        ? `- Rp ${new Intl.NumberFormat('id-ID').format(selectedAdminSlip.potonganAlpa!)}` 
                        : "Rp 0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-gray-100">
                    <span className="text-gray-700">BPJS Ketenagakerjaan ({selectedAdminSlip.bpjsTkRate ?? 2}%)</span>
                    <span className={(selectedAdminSlip.potonganBpjsTk || 0) > 0 ? "font-bold text-red-600" : "text-gray-500"}>
                      {(selectedAdminSlip.potonganBpjsTk || 0) > 0 
                        ? `- Rp ${new Intl.NumberFormat('id-ID').format(selectedAdminSlip.potonganBpjsTk!)}` 
                        : "Rp 0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-gray-100">
                    <span className="text-gray-700">BPJS Kesehatan ({selectedAdminSlip.bpjsKesRate ?? 1}%)</span>
                    <span className={(selectedAdminSlip.potonganBpjsKes || 0) > 0 ? "font-bold text-red-600" : "text-gray-500"}>
                      {(selectedAdminSlip.potonganBpjsKes || 0) > 0 
                        ? `- Rp ${new Intl.NumberFormat('id-ID').format(selectedAdminSlip.potonganBpjsKes!)}` 
                        : "Rp 0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-300 font-extrabold text-red-600 text-sm">
                    <span className="text-gray-800">Total Potongan (B)</span>
                    <span>
                      {(selectedAdminSlip.potongan || 0) > 0 
                        ? `- Rp ${new Intl.NumberFormat('id-ID').format(selectedAdminSlip.potongan)}` 
                        : "Rp 0"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* HIGHLIGHT BOX: TAKE HOME PAY */}
            <div className="border-2 border-pilar-darker rounded-2xl p-4 sm:p-5 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 shadow-sm space-y-4 sm:space-y-0">
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                  Gaji Bersih Diterima (Take Home Pay = A - B)
                </span>
                <span className="text-2xl font-black text-pilar-darker tracking-tight">
                  Rp {new Intl.NumberFormat('id-ID').format(selectedAdminSlip.gajiBersih || 0)}
                </span>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <i className="fa-solid fa-circle-check"></i>
                  <span>LUNAS DITRANSFER</span>
                </span>
              </div>
            </div>

            {/* TANDA TANGAN */}
            <div className="hidden print:grid grid-cols-2 gap-4 sm:gap-12 mt-12 text-center text-xs">
              <div>
                <p className="text-gray-600 mb-20 font-medium">Penerima (Karyawan),</p>
                <p className="font-bold text-gray-900 border-b border-gray-400 pb-1 inline-block min-w-[120px] sm:min-w-[200px] uppercase">
                  {selectedAdminSlip.nama}
                </p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Jakarta, {selectedAdminSlip.tanggal}</p>
                <p className="text-gray-600 mb-20 font-medium">Disahkan oleh (HRD & Finance),</p>
                <p className="font-bold text-gray-900 border-b border-gray-400 pb-1 inline-block min-w-[120px] sm:min-w-[200px]">
                  PT. PILAR SENTRA SOLUSI
                </p>
              </div>
            </div>

            {/* FOOTER */}
            <div className="hidden print:block mt-14 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400 italic">
              Dokumen ini diterbitkan secara resmi melalui Sistem Payroll Elektronik PT. Pilar Sentra Solusi dan merupakan bukti penerimaan gaji yang sah.
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
