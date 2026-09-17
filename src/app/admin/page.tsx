"use client";

import { useState, useEffect, useMemo } from "react";
import Toast from "@/components/Toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import dynamic from "next/dynamic";
import CustomSelect from "@/components/CustomSelect";
import { subscribeToRequests, updateRequestStatus, subscribeToLocations, addLocation, updateLocation, deleteLocation, subscribeToEmployees, subscribeToAllAttendance, subscribeToFinances, addFinanceTransaction, deleteFinanceTransaction, subscribeToSalaries, subscribeToNotifications, addNotification, paySalary, logAdminActivity, subscribeToAuditLogs, subscribeToPositions, addPosition, DEFAULT_POSITIONS, PositionItem, checkAdminRole, subscribeToAdmins, AdminAccount, SuratPeringatan, subscribeToSuratPeringatan, addSuratPeringatan, updateSuratPeringatan, deleteSuratPeringatan } from "@/lib/db";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

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
  createdAt?: string;
};

// Helper untuk parse tanggal baik format ISO (YYYY-MM-DD), timestamp ISO, maupun format lokal id-ID (D/M/YYYY atau DD/MM/YYYY)
const parseAttendanceDate = (dateStr: string | undefined | null): Date | null => {
  if (!dateStr) return null;
  if (typeof dateStr === 'string' && dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
  }
  if (typeof dateStr === 'string' && dateStr.includes('-')) {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

// Helper format ke YYYY-MM-DD standar berdasarkan waktu lokal
const formatLocalDateStr = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const [currentAdminEmail, setCurrentAdminEmail] = useState<string>("admin@pt-pilar.co.id");
  const [currentAdminName, setCurrentAdminName] = useState<string>("Administrator");
  const [currentAdminNik, setCurrentAdminNik] = useState<string>("");
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [adminRole, setAdminRole] = useState<"superadmin" | "admin">("admin");
  const [adminList, setAdminList] = useState<AdminAccount[]>([]);
  const [adminSearch, setAdminSearch] = useState<string>("");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState<string>("");
  const [auditFilterAction, setAuditFilterAction] = useState<string>("all");
  const [pengaturanSubTab, setPengaturanSubTab] = useState<"lokasi" | "audit" | "admins">("lokasi");
  const [karyawanSubTab, setKaryawanSubTab] = useState<"karyawan" | "sp">("karyawan");

  // State Modal & Form Manajemen Admin
  const [isAddAdminModalOpen, setIsAddAdminModalOpen] = useState(false);
  const [isEditAdminModalOpen, setIsEditAdminModalOpen] = useState(false);
  const [isDeleteAdminModalOpen, setIsDeleteAdminModalOpen] = useState(false);
  const [adminFormNama, setAdminFormNama] = useState("");
  const [adminFormNik, setAdminFormNik] = useState("");
  const [adminFormEmail, setAdminFormEmail] = useState("");
  const [adminFormPassword, setAdminFormPassword] = useState("");
  const [adminFormRole, setAdminFormRole] = useState<"admin" | "superadmin">("admin");
  const [selectedAdminForEdit, setSelectedAdminForEdit] = useState<AdminAccount | null>(null);
  const [selectedAdminForDelete, setSelectedAdminForDelete] = useState<AdminAccount | null>(null);
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [adminActionError, setAdminActionError] = useState("");

  useEffect(() => {
    setIsMounted(true);
    const savedMenu = localStorage.getItem("pilar_admin_menu");
    if (savedMenu) {
      if (savedMenu === "sp") {
        setActiveMenuState("karyawan");
        setKaryawanSubTab("sp");
      } else {
        setActiveMenuState(savedMenu);
      }
    }

    if (auth) {
      const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          const localAdmin = typeof window !== 'undefined' ? localStorage.getItem("admin_email") : null;
          if (!localAdmin) {
            router.replace("/admin/login");
          }
        } else {
          const email = (user.email || "").toLowerCase();
          setCurrentAdminEmail(email);
          const savedName = typeof window !== 'undefined' ? localStorage.getItem("admin_name") : null;
          const savedNik = typeof window !== 'undefined' ? localStorage.getItem("admin_nik") : null;
          if (savedName) setCurrentAdminName(savedName);
          if (savedNik) setCurrentAdminNik(savedNik);

          // Verifikasi hak akses Super Admin
          try {
            const roleInfo = await checkAdminRole(user.uid);
            const isSuper = roleInfo.isSuperAdmin || email === 'pilarss@admin.com' || (typeof window !== 'undefined' && localStorage.getItem("admin_role") === "superadmin");
            setIsSuperAdmin(isSuper);
            setAdminRole(isSuper ? 'superadmin' : 'admin');
            if (roleInfo.nama) {
              setCurrentAdminName(roleInfo.nama);
              localStorage.setItem("admin_name", roleInfo.nama);
            }
            if (roleInfo.nik) {
              setCurrentAdminNik(roleInfo.nik);
              localStorage.setItem("admin_nik", roleInfo.nik);
            }
          } catch (e) {
            if (email === 'pilarss@admin.com') {
              setIsSuperAdmin(true);
              setAdminRole('superadmin');
            }
          }
        }
      });
      return () => unsubscribeAuth();
    }
  }, []);

  // Proteksi Audit Log & Kelola Admin: Hanya Super Admin saja
  useEffect(() => {
    if (!isSuperAdmin && (pengaturanSubTab === "audit" || pengaturanSubTab === "admins")) {
      setPengaturanSubTab("lokasi");
    }
  }, [isSuperAdmin, pengaturanSubTab]);

  // Berlangganan Audit Logs hanya jika Super Admin
  useEffect(() => {
    if (!isSuperAdmin) return;
    const unsubAudit = subscribeToAuditLogs((logs) => {
      setAuditLogs(logs);
    });
    return () => unsubAudit();
  }, [isSuperAdmin]);

  // Berlangganan Daftar Admin hanya jika Super Admin
  useEffect(() => {
    if (!isSuperAdmin) return;
    const unsubAdmins = subscribeToAdmins((list) => {
      setAdminList(list);
    });
    return () => unsubAdmins();
  }, [isSuperAdmin]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
    } catch {}
    localStorage.removeItem("admin_email");
    localStorage.removeItem("admin_role");
    localStorage.removeItem("admin_name");
    localStorage.removeItem("admin_nik");
    localStorage.removeItem("pilar_admin_menu");
    if (auth) {
      try {
        await signOut(auth);
      } catch {}
    }
    router.push("/admin/login");
  };

  // Handlers untuk Kelola Admin
  const handleOpenAddAdmin = () => {
    setAdminFormNama("");
    setAdminFormNik("");
    setAdminFormEmail("");
    setAdminFormPassword("");
    setAdminFormRole("admin");
    setAdminActionError("");
    setIsAddAdminModalOpen(true);
  };

  const handleOpenEditAdmin = (admin: AdminAccount) => {
    setSelectedAdminForEdit(admin);
    setAdminFormNama(admin.nama);
    setAdminFormNik(admin.nik || "");
    setAdminFormEmail(admin.email);
    setAdminFormPassword("");
    setAdminFormRole(admin.role);
    setAdminActionError("");
    setIsEditAdminModalOpen(true);
  };

  const handleOpenDeleteAdmin = (admin: AdminAccount) => {
    setSelectedAdminForDelete(admin);
    setAdminActionError("");
    setIsDeleteAdminModalOpen(true);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminFormNama.trim()) {
      setAdminActionError("Nama asli administrator wajib diisi.");
      return;
    }
    if (!adminFormNik.trim()) {
      setAdminActionError("Nomor Induk Karyawan (NIK) wajib diisi untuk dokumen resmi.");
      return;
    }
    if (!adminFormEmail.trim() || !adminFormPassword.trim()) {
      setAdminActionError("Email dan kata sandi wajib diisi.");
      return;
    }
    if (adminFormPassword.length < 6) {
      setAdminActionError("Kata sandi minimal 6 karakter.");
      return;
    }

    setAdminActionLoading(true);
    setAdminActionError("");
    try {
      const token = await auth?.currentUser?.getIdToken();
      const res = await fetch("/api/admin/manage-admins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          nama: adminFormNama.trim(),
          nik: adminFormNik.trim(),
          email: adminFormEmail.trim(),
          password: adminFormPassword,
          role: adminFormRole
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal membuat akun admin.");
      }

      showToast(`Akun ${adminFormNama} (NIK: ${adminFormNik.trim()}) berhasil dibuat.`);
      setIsAddAdminModalOpen(false);
    } catch (err: any) {
      setAdminActionError(err.message || "Gagal membuat akun admin.");
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdminForEdit) return;
    if (!adminFormNama.trim()) {
      setAdminActionError("Nama lengkap wajib diisi.");
      return;
    }
    if (!adminFormNik.trim()) {
      setAdminActionError("Nomor Induk Karyawan (NIK) wajib diisi.");
      return;
    }
    if (adminFormPassword && adminFormPassword.length < 6) {
      setAdminActionError("Kata sandi baru minimal 6 karakter jika ingin diubah.");
      return;
    }

    setAdminActionLoading(true);
    setAdminActionError("");
    try {
      const token = await auth?.currentUser?.getIdToken();
      const res = await fetch("/api/admin/manage-admins", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          uid: selectedAdminForEdit.uid,
          nama: adminFormNama.trim(),
          nik: adminFormNik.trim(),
          password: adminFormPassword || undefined,
          role: adminFormRole
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memperbarui data admin.");
      }

      // Jika mengedit profil akun sendiri, sinkronkan state lokal
      if (selectedAdminForEdit.uid === auth?.currentUser?.uid) {
        setCurrentAdminName(adminFormNama.trim());
        setCurrentAdminNik(adminFormNik.trim());
        localStorage.setItem("admin_name", adminFormNama.trim());
        localStorage.setItem("admin_nik", adminFormNik.trim());
      }

      showToast("Data akun admin & NIK berhasil diperbarui.");
      setIsEditAdminModalOpen(false);
    } catch (err: any) {
      setAdminActionError(err.message || "Gagal memperbarui akun admin.");
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!selectedAdminForDelete) return;

    setAdminActionLoading(true);
    setAdminActionError("");
    try {
      const token = await auth?.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/manage-admins?uid=${selectedAdminForDelete.uid}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus admin.");
      }

      showToast(`Akses admin ${selectedAdminForDelete.nama} berhasil dicabut.`);
      setIsDeleteAdminModalOpen(false);
    } catch (err: any) {
      setAdminActionError(err.message || "Gagal menghapus admin.");
    } finally {
      setAdminActionLoading(false);
    }
  };

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
  const [formPosisi, setFormPosisi] = useState("Pengawas");
  const [formStatus, setFormStatus] = useState<"Aktif" | "Nonaktif">("Aktif");
  const [formLokasiId, setFormLokasiId] = useState("all");
  const [formShiftMasuk, setFormShiftMasuk] = useState("08:00");
  const [formShiftKeluar, setFormShiftKeluar] = useState("17:00");
  const [formGajiPokok, setFormGajiPokok] = useState("0");
  const [formBpjsTk, setFormBpjsTk] = useState(true);
  const [formBpjsKes, setFormBpjsKes] = useState(true);
  const [isSavingKaryawan, setIsSavingKaryawan] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formTouched, setFormTouched] = useState<Record<string, boolean>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Master Positions State
  const [positions, setPositions] = useState<PositionItem[]>(
    DEFAULT_POSITIONS.map((p, idx) => ({ id: `default-${idx}`, nama: p, isDefault: true }))
  );
  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  const [newPositionName, setNewPositionName] = useState("");
  const [isSavingPosition, setIsSavingPosition] = useState(false);
  const [positionModalError, setPositionModalError] = useState("");

  const positionOptions = useMemo(() => {
    const names = new Set(positions.map(p => p.nama));
    const extraOptions: { value: string; label: string }[] = [];
    karyawanList.forEach(k => {
      if (k.posisi && !names.has(k.posisi)) {
        names.add(k.posisi);
        extraOptions.push({ value: k.posisi, label: k.posisi });
      }
    });
    const mainOptions = positions.map(p => ({ value: p.nama, label: p.nama }));
    return [...mainOptions, ...extraOptions];
  }, [positions, karyawanList]);

  const handleAddNewPosition = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newPositionName.trim()) {
      setPositionModalError("Nama posisi / jabatan tidak boleh kosong");
      return;
    }
    setIsSavingPosition(true);
    setPositionModalError("");
    try {
      const res = await addPosition(newPositionName.trim());
      if (res.success) {
        const addedName = newPositionName.trim();
        setFormPosisi(addedName);
        setShowAddPositionModal(false);
        setNewPositionName("");
        showToast(`Posisi "${addedName}" berhasil ditambahkan!`);
      } else {
        setPositionModalError(res.error || "Gagal menambahkan posisi");
      }
    } catch (err: any) {
      setPositionModalError(err.message || "Terjadi kesalahan sistem");
    } finally {
      setIsSavingPosition(false);
    }
  };

  const markTouched = (field: string) => {
    setFormTouched(prev => ({ ...prev, [field]: true }));
  };

  const validation = useMemo(() => {
    // 1. No WA
    const cleanWa = formNoWa.replace(/[\s-]/g, "");
    const isWaPattern = /^(08|\+628|628)[0-9]{8,13}$/.test(cleanWa);
    const isWaValid = cleanWa.length === 0 || isWaPattern;
    const waError = cleanWa.length > 0 && !isWaPattern
      ? "Format nomor WhatsApp tidak valid (contoh: 081234567890)"
      : "";

    // 2. Email
    const cleanEmail = formEmail.trim().toLowerCase();
    const isEmailFormatValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
    const isEmailDuplicate = Boolean(
      cleanEmail &&
      karyawanList.some(k => k.email.toLowerCase() === cleanEmail && k.id !== editingKaryawan?.id)
    );
    const emailError = !cleanEmail 
      ? "Email akses wajib diisi" 
      : !isEmailFormatValid 
      ? "Format email tidak valid (contoh: nama@perusahaan.com)" 
      : isEmailDuplicate 
      ? "Email ini sudah digunakan oleh akun karyawan lain" 
      : "";
    const isEmailValid = cleanEmail.length > 0 && isEmailFormatValid && !isEmailDuplicate;

    // 3. Password
    let passwordError = "";
    let isPasswordValid = true;
    if (!editingKaryawan) {
      if (!formPassword) {
        passwordError = "Kata sandi wajib diisi untuk karyawan baru";
        isPasswordValid = false;
      } else if (formPassword.length < 6) {
        passwordError = `Minimal 6 karakter (kurang ${6 - formPassword.length} karakter lagi)`;
        isPasswordValid = false;
      }
    } else {
      if (formPassword && formPassword !== "••••••••" && formPassword.length < 6) {
        passwordError = `Minimal 6 karakter (kurang ${6 - formPassword.length} karakter lagi)`;
        isPasswordValid = false;
      }
    }

    const isFormValid = isWaValid && isEmailValid && isPasswordValid && formNama.trim().length > 0 && formPosisi.trim().length > 0;

    return {
      isWaValid,
      waError,
      isEmailValid,
      isEmailDuplicate,
      emailError,
      isPasswordValid,
      passwordError,
      isFormValid
    };
  }, [formNama, formNoWa, formEmail, formPassword, formPosisi, karyawanList, editingKaryawan]);
  
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

  // Surat Peringatan (SP) State
  const [spList, setSpList] = useState<SuratPeringatan[]>([]);
  const [selectedSpDetail, setSelectedSpDetail] = useState<SuratPeringatan | null>(null);
  const [isAddSpModalOpen, setIsAddSpModalOpen] = useState(false);
  const [isDeleteSpModalOpen, setIsDeleteSpModalOpen] = useState(false);
  const [spToDelete, setSpToDelete] = useState<SuratPeringatan | null>(null);
  const [spFilterKaryawan, setSpFilterKaryawan] = useState("all");
  const [spFilterTingkat, setSpFilterTingkat] = useState("all");
  const [spFilterStatus, setSpFilterStatus] = useState("all");
  const [spSearchQuery, setSpSearchQuery] = useState("");

  // Form State Tambah SP
  const [spFormKaryawanId, setSpFormKaryawanId] = useState("");
  const [spFormTingkat, setSpFormTingkat] = useState<"Surat Teguran" | "SP 1" | "SP 2" | "SP 3">("SP 1");
  const [spFormNomor, setSpFormNomor] = useState("");
  const [spFormTanggal, setSpFormTanggal] = useState(() => formatLocalDateStr(new Date()));
  const [spFormMasaBulan, setSpFormMasaBulan] = useState(6);
  const [spFormAlasan, setSpFormAlasan] = useState("");
  const [spFormDetail, setSpFormDetail] = useState("");
  const [spFormTindakan, setSpFormTindakan] = useState("");
  const [isSavingSp, setIsSavingSp] = useState(false);

  // Helper hitung nomor SP otomatis
  const generateSpNumber = (tingkat: "Surat Teguran" | "SP 1" | "SP 2" | "SP 3") => {
    try {
      const romanMonths = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
      const now = new Date();
      const romanM = romanMonths[now.getMonth()] || "IX";
      const year = now.getFullYear();
      const countThisMonth = (spList || []).filter(s => {
        if (!s || !s.tanggalTerbit) return false;
        const d = new Date(s.tanggalTerbit);
        return !isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === year;
      }).length;
      const seq = String(countThisMonth + 1).padStart(3, "0");
      const code = tingkat === "Surat Teguran" ? "ST" : (tingkat || "SP 1").replace(" ", "-");
      return `${seq}/${code}/HRD-PSS/${romanM}/${year}`;
    } catch (e) {
      return `001/SP-1/HRD-PSS/IX/${new Date().getFullYear()}`;
    }
  };

  const handleOpenAddSpModal = () => {
    try {
      const defaultTingkat: "SP 1" = "SP 1";
      setSpFormTingkat(defaultTingkat);
      setSpFormNomor(generateSpNumber(defaultTingkat));
      try {
        setSpFormTanggal(formatLocalDateStr(new Date()));
      } catch {
        setSpFormTanggal(new Date().toISOString().split("T")[0]);
      }
      setSpFormMasaBulan(6);
      setSpFormAlasan("");
      setSpFormDetail("");
      setSpFormTindakan("");
      if (Array.isArray(karyawanList) && karyawanList.length > 0) {
        setSpFormKaryawanId(karyawanList[0].id);
      } else {
        setSpFormKaryawanId("");
      }
      setIsAddSpModalOpen(true);
    } catch (err: any) {
      console.error("Gagal membuka modal SP:", err);
      setIsAddSpModalOpen(true);
    }
  };

  const handleSaveSp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spFormKaryawanId) return showToast("Silakan pilih karyawan penerima SP", "error");
    if (!spFormNomor.trim()) return showToast("Nomor surat wajib diisi", "error");
    if (!spFormAlasan.trim()) return showToast("Alasan pelanggaran wajib diisi", "error");

    const emp = karyawanList.find(k => k.id === spFormKaryawanId);
    if (!emp) return showToast("Data karyawan tidak ditemukan", "error");

    const dTerbit = new Date(spFormTanggal);
    const dSampai = new Date(spFormTanggal);
    dSampai.setMonth(dSampai.getMonth() + (spFormMasaBulan || 6));

    setIsSavingSp(true);
    try {
      const res = await addSuratPeringatan({
        nomorSurat: spFormNomor.trim(),
        karyawanId: emp.id,
        karyawanNama: emp.nama,
        karyawanNik: emp.noInduk || "-",
        karyawanPosisi: emp.posisi || "-",
        tingkatSp: spFormTingkat,
        alasanPelanggaran: spFormAlasan.trim(),
        detailPelanggaran: spFormDetail.trim(),
        tindakanPerbaikan: spFormTindakan.trim() || undefined,
        tanggalTerbit: spFormTanggal,
        berlakuMulai: spFormTanggal,
        berlakuSampai: formatLocalDateStr(dSampai),
        status: "Aktif",
        hrdNama: currentAdminName || "PT. PILAR SENTRA SOLUSI",
        hrdNik: currentAdminNik || "-",
        hrdJabatan: isSuperAdmin ? "Super Admin & Direktur" : "HRD & Personalia Manager",
        isAcknowledged: false
      });

      if (res.success) {
        try {
          const targetIds = Array.from(new Set([emp.id, (emp as any).karyawanId, emp.noInduk].filter(Boolean))) as string[];
          for (const tid of targetIds) {
            await addNotification(
              tid,
              `Pemberitahuan ${spFormTingkat}`,
              `Pemberitahuan resmi ${spFormTingkat} (${spFormNomor.trim()}) telah diterbitkan oleh Manajemen. Silakan cek menu Pengaturan akun Anda. Dokumen fisik akan diserahkan langsung oleh HRD.`,
              "warning"
            );
          }
        } catch (notifErr) {
          console.error("Gagal mengirim notifikasi SP:", notifErr);
        }
        showToast("Pemberitahuan Surat Peringatan berhasil diterbitkan!");
        setIsAddSpModalOpen(false);
      } else {
        showToast(res.error || "Gagal menerbitkan SP", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Terjadi kesalahan", "error");
    } finally {
      setIsSavingSp(false);
    }
  };

  const handleUpdateSpStatus = async (spId: string, newStatus: "Aktif" | "Selesai" | "Dibatalkan") => {
    const ok = await updateSuratPeringatan(spId, { status: newStatus });
    if (ok) {
      showToast(`Status SP diubah menjadi ${newStatus}`);
    } else {
      showToast("Gagal mengubah status SP", "error");
    }
  };

  const handleDeleteSp = async () => {
    if (!spToDelete?.id) return;
    const ok = await deleteSuratPeringatan(spToDelete.id);
    if (ok) {
      showToast("Surat Peringatan berhasil dihapus");
      setIsDeleteSpModalOpen(false);
      setSpToDelete(null);
    } else {
      showToast("Gagal menghapus SP", "error");
    }
  };

  // Penggajian State
  const [workingDays, setWorkingDays] = useState(22);
  const [absences, setAbsences] = useState<Record<string, number>>({});
  const [showGajiChart, setShowGajiChart] = useState(true);
  const [selectedAdminSlip, setSelectedAdminSlip] = useState<any | null>(null);

  const getAdminSlipPenerima = (slip: any) => {
    if (!slip) return { nik: "-", jabatan: "Karyawan" };
    const emp = karyawanList.find(k => k.id === slip.karyawanId || k.nama === slip.nama);
    const nik = slip.nik || slip.karyawanNik || emp?.noInduk || "-";
    const jabatan = slip.jabatan || slip.posisi || slip.karyawanPosisi || emp?.posisi || "Karyawan";
    return { nik, jabatan };
  };
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

  // Confirmation Modal State (Standardized)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    details?: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "primary" | "warning";
    icon?: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  useEffect(() => {
    // Load positions via Firestore
    const unsubscribePositions = subscribeToPositions((data) => {
      setPositions(data);
    });

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

    // Load Surat Peringatan
    const unsubscribeSp = subscribeToSuratPeringatan((data) => {
      setSpList(data);
    });

    return () => {
      unsubscribePositions();
      unsubscribeRequests();
      unsubscribeLocations();
      unsubscribeEmployees();
      unsubscribeAttendance();
      unsubscribeFinances();
      unsubscribeSalaries();
      unsubscribeSp();
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
        logAdminActivity({
          adminEmail: currentAdminEmail,
          adminName: currentAdminName,
          action: "MANAJEMEN_LOKASI",
          target: formLokasiNama,
          details: `Memperbarui koordinat/radius cabang ${formLokasiNama} (${officeRadius} meter)`
        });
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
        logAdminActivity({
          adminEmail: currentAdminEmail,
          adminName: currentAdminName,
          action: "MANAJEMEN_LOKASI",
          target: formLokasiNama,
          details: `Menambahkan cabang baru ${formLokasiNama} dengan radius ${officeRadius} meter`
        });
      } else {
        showToast("Gagal menambahkan lokasi.");
      }
    }
    
    setEditingLocationId(null);
    setFormLokasiNama("");
    setIsLocationModalOpen(false);
  };

  const handleDeleteLocation = (id: string) => {
    const locToDelete = locations.find(l => l.id === id);
    setConfirmModal({
      isOpen: true,
      title: "Hapus Lokasi Kantor?",
      message: locToDelete 
        ? `Apakah Anda yakin ingin menghapus lokasi "${locToDelete.nama}" dari sistem absensi?`
        : "Apakah Anda yakin ingin menghapus titik lokasi ini?",
      confirmText: "Ya, Hapus Lokasi",
      variant: "danger",
      icon: "fa-solid fa-trash-can",
      onConfirm: async () => {
        const success = await deleteLocation(id);
        if (success) {
          showToast("Lokasi dihapus.");
          logAdminActivity({
            adminEmail: currentAdminEmail,
            adminName: currentAdminName,
            action: "MANAJEMEN_LOKASI",
            target: locToDelete?.nama || id,
            details: `Menghapus cabang kantor ${locToDelete?.nama || id}`
          });
        } else {
          showToast("Gagal menghapus lokasi.");
        }
        setConfirmModal(null);
      }
    });
  };

  const showToast = (msg: string, type?: string) => {
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
    await updateRequestStatus(id, "Disetujui", "", {
      approverNama: currentAdminName,
      approverNik: currentAdminNik,
      approverEmail: currentAdminEmail
    });
    showToast("Pengajuan disetujui.");
    const req = pengajuanList.find((r: any) => r.id === id);
    if (req && req.karyawanId) {
      addNotification(req.karyawanId, "Pengajuan Disetujui", "Hore! Pengajuan Anda telah DISETUJUI oleh HRD.", "success");
    }
    logAdminActivity({
      adminEmail: currentAdminEmail,
      adminName: currentAdminName,
      action: "SETUJUI_PENGAJUAN",
      target: req?.namaKaryawan || id,
      details: `Menyetujui permohonan ${req?.type || 'Izin/Cuti'} untuk ${req?.namaKaryawan || id} (Oleh: ${currentAdminName}${currentAdminNik ? ` / NIK: ${currentAdminNik}` : ''})`
    });
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
    logAdminActivity({
      adminEmail: currentAdminEmail,
      adminName: currentAdminName,
      action: "TOLAK_PENGAJUAN",
      target: req?.namaKaryawan || rejectId,
      details: `Mengembalikan permohonan ${req?.type || 'Izin/Cuti'} dengan catatan: "${rejectReason}"`
    });
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
        "TLM (x)": s.tlm || 0,
        "Denda TLM": s.dendaTlm || 0,
        "TAM (x)": s.tam || 0,
        "Denda TAM": s.dendaTam || 0,
        "TAP (x)": s.tap || 0,
        "Denda TAP": s.dendaTap || 0,
        "Total Denda Absensi": s.totalDenda || 0,
        "Hari Alpa (A)": s.alpa || 0,
        "Potongan Alpa": s.potonganAlpa || 0,
        "Hari Izin (I)": s.izin || 0,
        "Potongan Izin": s.potonganIzin || 0,
        "Total Potongan Kehadiran": s.totalPotonganKehadiran || s.potonganAlpa || 0,
        "Potongan BPJS TK": s.potonganBpjsTk || 0,
        "Potongan BPJS Kes": s.potonganBpjsKes || 0,
        "Total Seluruh Potongan": s.potongan || 0,
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
    setFormPosisi(positions[0]?.nama || "Pengawas");
    setFormStatus("Aktif");
    setFormLokasiId("all");
    setFormShiftMasuk("08:00");
    setFormShiftKeluar("17:00");
    setFormGajiPokok("0");
    setFormBpjsTk(true);
    setFormBpjsKes(true);
    setFormTouched({});
    setFocusedField(null);
    setShowPassword(false);
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
    setFormTouched({});
    setFocusedField(null);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleDeleteKaryawan = (id: string) => {
    const empToDelete = karyawanList.find(k => k.id === id);
    setConfirmModal({
      isOpen: true,
      title: "Hapus Akun Karyawan?",
      message: empToDelete 
        ? `Apakah Anda yakin ingin menghapus data karyawan "${empToDelete.nama}"?`
        : "Apakah Anda yakin ingin menghapus akun karyawan ini?",
      confirmText: "Ya, Hapus Karyawan",
      variant: "danger",
      icon: "fa-solid fa-trash-can",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/auth/karyawan?uid=${id}`, { method: 'DELETE' });
          if (res.ok) {
            showToast("Karyawan berhasil dihapus.");
            logAdminActivity({
              adminEmail: currentAdminEmail,
              adminName: currentAdminName,
              action: "HAPUS_KARYAWAN",
              target: empToDelete?.nama || id,
              details: `Menghapus akun karyawan ${empToDelete?.nama || id} (${empToDelete?.posisi || '-'})`
            });
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
    if (!formNama.trim() || !formEmail.trim() || !formPosisi.trim()) {
      return showToast("Semua field wajib diisi.");
    }
    if (!editingKaryawan && !formPassword) {
      return showToast("Password wajib diisi untuk karyawan baru.");
    }

    setFormTouched({
      noWa: true,
      email: true,
      password: true
    });

    if (!validation.isFormValid) {
      if (validation.emailError) return showToast(validation.emailError);
      if (validation.passwordError) return showToast(validation.passwordError);
      if (validation.waError) return showToast(validation.waError);
      return showToast("Harap periksa kembali isian formulir.");
    }

    setIsSavingKaryawan(true);
    try {
      const res = await fetch('/api/auth/karyawan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingKaryawan?.id,
          noInduk: formNoInduk || "",
          noWa: formNoWa || "",
          nama: formNama,
          email: formEmail,
          password: formPassword === "••••••••" ? "" : formPassword,
          posisi: formPosisi,
          status: formStatus || "Aktif",
          lokasiId: formLokasiId || "all",
          shiftMasuk: formShiftMasuk || "08:00",
          shiftKeluar: formShiftKeluar || "17:00",
          gajiPokok: parseInt(formGajiPokok) || 0,
          bpjsTk: formBpjsTk,
          bpjsKes: formBpjsKes
        })
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch (e) {
        console.error("Gagal parse JSON response:", e);
      }

      if (res.ok && data?.success) {
        showToast(editingKaryawan ? "Data karyawan berhasil diperbarui!" : "Karyawan baru berhasil ditambahkan!");
        logAdminActivity({
          adminEmail: currentAdminEmail,
          adminName: currentAdminName,
          action: editingKaryawan ? "UPDATE_KARYAWAN" : "TAMBAH_KARYAWAN",
          target: formNama,
          details: editingKaryawan 
            ? `Memperbarui data karyawan ${formNama} (${formPosisi})`
            : `Menambahkan karyawan baru ${formNama} (${formPosisi}) - Gaji Pokok Rp ${parseInt(formGajiPokok || "0").toLocaleString('id-ID')}`
        });
        setIsModalOpen(false);
      } else {
        showToast(data?.error || `Gagal menyimpan: Terjadi kesalahan (Status ${res.status})`);
      }
    } catch (error: any) {
      console.error("Error saving karyawan:", error);
      showToast(error?.message ? `Gagal menyimpan: ${error.message}` : "Terjadi kesalahan sistem saat menyimpan data.");
    } finally {
      setIsSavingKaryawan(false);
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
    currentBpjsKesRate: number = 1,
    extraData?: {
      tlm?: number;
      tam?: number;
      tap?: number;
      dendaTlm?: number;
      dendaTam?: number;
      dendaTap?: number;
      totalDenda?: number;
      izin?: number;
      potonganIzin?: number;
      totalPotonganKehadiran?: number;
      totalPotongan?: number;
    }
  ) => {
    if (nominal <= 0) return showToast("Nominal gaji tidak valid.");
    setConfirmModal({
      isOpen: true,
      title: "Konfirmasi Pencairan Gaji",
      message: `Apakah Anda yakin ingin mencairkan gaji sebesar Rp ${new Intl.NumberFormat('id-ID').format(nominal)} untuk ${nama}?`,
      confirmText: "Ya, Cairkan Gaji",
      variant: "primary",
      icon: "fa-solid fa-money-bill-wave",
      onConfirm: async () => {
        const timestamp = Date.now();
        const dateStr = new Date().toLocaleDateString('id-ID');
        const totalPotongan = extraData?.totalPotongan ?? (potonganAlpa + potonganBpjsTk + potonganBpjsKes);
        
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
        const emp = karyawanList.find(k => k.id === karyawanId || k.nama === nama);
        const empNik = emp?.noInduk || "";
        const empPosisi = emp?.posisi || "";
        const newSlipGaji = {
          id: "SLIP-" + timestamp,
          karyawanId,
          nama,
          nik: empNik,
          karyawanNik: empNik,
          posisi: empPosisi,
          jabatan: empPosisi,
          karyawanPosisi: empPosisi,
          tanggal: dateStr,
          gajiPokok,
          potongan: totalPotongan,
          // Denda absensi (TLM, TAM, TAP)
          tlm: extraData?.tlm || 0,
          tam: extraData?.tam || 0,
          tap: extraData?.tap || 0,
          dendaTlm: extraData?.dendaTlm || 0,
          dendaTam: extraData?.dendaTam || 0,
          dendaTap: extraData?.dendaTap || 0,
          totalDenda: extraData?.totalDenda || 0,
          // Kehadiran (No Work, No Pay - A, I)
          alpa,
          potonganAlpa,
          izin: extraData?.izin || 0,
          potonganIzin: extraData?.potonganIzin || 0,
          totalPotonganKehadiran: extraData?.totalPotonganKehadiran || potonganAlpa,
          // BPJS
          potonganBpjsTk,
          potonganBpjsKes,
          bpjsTkRate: currentBpjsTkRate,
          bpjsKesRate: currentBpjsKesRate,
          gajiBersih: nominal,
          hrdNama: currentAdminName,
          hrdNik: currentAdminNik,
          adminEmail: currentAdminEmail,
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

        logAdminActivity({
          adminEmail: currentAdminEmail,
          adminName: currentAdminName,
          action: "BAYAR_GAJI",
          target: nama,
          details: `Pencairan gaji bersih Rp ${new Intl.NumberFormat('id-ID').format(nominal)} (Pokok Rp ${new Intl.NumberFormat('id-ID').format(gajiPokok)}, Potongan Rp ${new Intl.NumberFormat('id-ID').format(totalPotongan)})`
        });

        showToast(`Gaji ${nama} berhasil dibayarkan!`);
        setConfirmModal(null);
      }
    });
  };

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchAction = auditFilterAction === "all" || log.action === auditFilterAction;
      const searchLower = auditSearch.toLowerCase();
      const matchSearch = !auditSearch || 
        (log.adminEmail || "").toLowerCase().includes(searchLower) ||
        (log.adminName || "").toLowerCase().includes(searchLower) ||
        (log.target || "").toLowerCase().includes(searchLower) ||
        (log.details || "").toLowerCase().includes(searchLower) ||
        (log.action || "").toLowerCase().includes(searchLower);
      return matchAction && matchSearch;
    });
  }, [auditLogs, auditSearch, auditFilterAction]);

  const getActionBadge = (action: string) => {
    switch(action) {
      case "TAMBAH_KARYAWAN":
        return <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200"><i className="fa-solid fa-user-plus mr-1"></i> Tambah Karyawan</span>;
      case "UPDATE_KARYAWAN":
        return <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200"><i className="fa-solid fa-user-pen mr-1"></i> Update Karyawan</span>;
      case "HAPUS_KARYAWAN":
        return <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200"><i className="fa-solid fa-user-minus mr-1"></i> Hapus Karyawan</span>;
      case "SETUJUI_PENGAJUAN":
        return <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200"><i className="fa-solid fa-check-double mr-1"></i> Setujui Pengajuan</span>;
      case "TOLAK_PENGAJUAN":
        return <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200"><i className="fa-solid fa-rotate-left mr-1"></i> Revisi/Tolak</span>;
      case "BAYAR_GAJI":
        return <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200"><i className="fa-solid fa-money-bill-transfer mr-1"></i> Pencairan Gaji</span>;
      case "MANAJEMEN_LOKASI":
        return <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200"><i className="fa-solid fa-map-pin mr-1"></i> Kelola Lokasi</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-gray-50 text-gray-700 border border-gray-200">{action}</span>;
    }
  };

  const matrixLaporan = useMemo(() => {
    const filteredLaporan = riwayatLaporan.filter(log => {
       const logDate = parseAttendanceDate(log.tanggal);
       if (!logDate) return false;
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

    const now = new Date();
    const todayStr = formatLocalDateStr(now);

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
          const lDate = parseAttendanceDate(l.tanggal);
          if (lDate) {
             const dStr = formatLocalDateStr(lDate);
             logsByDate[dStr] = l;
          }
       });

       const leavesByDate: Record<string, string> = {};
       approvedIzinSakit.filter(p => p.karyawanId === karyawan.id).forEach(p => {
          const pStart = parseAttendanceDate(p.startDate);
          const pEnd = parseAttendanceDate(p.endDate);
          if (pStart && pEnd) {
             let curr = new Date(pStart);
             while(curr <= pEnd) {
                const dStr = formatLocalDateStr(curr);
                leavesByDate[dStr] = p.type;
                curr.setDate(curr.getDate() + 1);
             }
          }
       });

       // Tanggal bergabung karyawan
       const joinDate = parseAttendanceDate(karyawan.createdAt);
       const joinDateStr = joinDate ? formatLocalDateStr(joinDate) : null;

       for (let day = 1; day <= new Date(laporanTahun, laporanBulan, 0).getDate(); day++) {
          const date = new Date(laporanTahun, laporanBulan - 1, day);
          if (date.getDay() === 0 || date.getDay() === 6) continue; // Lewati weekend

          const dStr = `${laporanTahun}-${String(laporanBulan).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

          // Lewati hari di masa depan
          if (dStr > todayStr) continue;

          // Lewati hari sebelum karyawan bergabung/dibuat
          if (joinDateStr && dStr < joinDateStr) continue;

          // Jika hari ini masih berjalan dan belum ada log absensi, jangan langsung anggap Alpha/bolos
          if (dStr === todayStr && !logsByDate[dStr]) {
             continue;
          }

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
          id: karyawan.id,
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
            type={
              toastMessage.toLowerCase().includes("gagal") || 
              toastMessage.toLowerCase().includes("harus") || 
              toastMessage.toLowerCase().includes("tidak valid") || 
              toastMessage.toLowerCase().includes("wajib") ||
              toastMessage.toLowerCase().includes("sudah") ||
              toastMessage.toLowerCase().includes("kesalahan") ||
              toastMessage.toLowerCase().includes("minimal")
                ? "error" 
                : "success"
            }
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
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Nama Lengkap</label>
                      <input 
                        type="text" required value={formNama} onChange={(e) => setFormNama(e.target.value)}
                        placeholder="Masukkan nama lengkap"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all text-sm bg-gray-50/50 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">No. Induk / KTP</label>
                      <input 
                        type="text" required value={formNoInduk} onChange={(e) => setFormNoInduk(e.target.value)}
                        placeholder="Wajib diisi"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all text-sm bg-gray-50/50 focus:bg-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-sm font-bold text-gray-700">No. Whatsapp (WA)</label>
                        {focusedField === "noWa" && formNoWa && validation.isWaValid && (
                          <span className="text-[11px] font-semibold flex items-center gap-1 text-emerald-600 animate-in fade-in duration-150">
                            <i className="fa-solid fa-check"></i> Format Sesuai
                          </span>
                        )}
                        {formTouched.noWa && formNoWa && !validation.isWaValid && (
                          <span className="text-[11px] font-semibold flex items-center gap-1 text-red-500 animate-in fade-in duration-150">
                            <i className="fa-solid fa-xmark"></i> Format Salah
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input 
                          type="tel" value={formNoWa} 
                          onChange={(e) => { setFormNoWa(e.target.value); markTouched("noWa"); }}
                          onFocus={() => setFocusedField("noWa")}
                          onBlur={() => { markTouched("noWa"); setFocusedField(null); }}
                          placeholder="Contoh: 08123456789"
                          className={`w-full border rounded-xl px-4 py-3 pr-10 focus:outline-none shadow-sm transition-all text-sm ${
                            formTouched.noWa && formNoWa && !validation.isWaValid
                              ? "border-red-400 bg-red-50/20 text-red-900 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                              : focusedField === "noWa" && formNoWa && validation.isWaValid
                              ? "border-emerald-400 bg-emerald-50/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                              : "border-gray-200 bg-gray-50/50 focus:bg-white focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker"
                          }`}
                        />
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                          {focusedField === "noWa" && formNoWa && validation.isWaValid && (
                            <i className="fa-solid fa-circle-check text-emerald-500 text-sm animate-in fade-in duration-150"></i>
                          )}
                          {formTouched.noWa && formNoWa && !validation.isWaValid && (
                            <i className="fa-solid fa-circle-exclamation text-red-500 text-sm"></i>
                          )}
                        </div>
                      </div>
                      {formTouched.noWa && validation.waError && (
                        <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1.5 font-medium animate-in fade-in duration-200">
                          <i className="fa-solid fa-triangle-exclamation text-[11px] shrink-0"></i>
                          <span>{validation.waError}</span>
                        </p>
                      )}
                      {focusedField === "noWa" && formNoWa && validation.isWaValid && (
                        <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1.5 font-medium animate-in fade-in duration-150">
                          <i className="fa-solid fa-check text-[11px] shrink-0"></i>
                          <span>Nomor WhatsApp valid untuk notifikasi</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Akun Akses */}
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2 flex items-center"><i className="fa-solid fa-shield-halved mr-2"></i> 2. Akun & Keamanan</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-sm font-bold text-gray-700">Email Akses</label>
                        {focusedField === "email" && formEmail && validation.isEmailValid && (
                          <span className="text-[11px] font-semibold flex items-center gap-1 text-emerald-600 animate-in fade-in duration-150">
                            <i className="fa-solid fa-check"></i> Tersedia
                          </span>
                        )}
                        {formTouched.email && formEmail && !validation.isEmailValid && (
                          <span className="text-[11px] font-semibold flex items-center gap-1 text-red-500 animate-in fade-in duration-150">
                            <i className="fa-solid fa-xmark"></i> {validation.isEmailDuplicate ? 'Sudah Terdaftar' : 'Tidak Valid'}
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input 
                          type="email" required value={formEmail} 
                          onChange={(e) => { setFormEmail(e.target.value); markTouched("email"); }}
                          onFocus={() => setFocusedField("email")}
                          onBlur={() => { markTouched("email"); setFocusedField(null); }}
                          autoComplete="off"
                          placeholder="nama@perusahaan.com"
                          className={`w-full border rounded-xl px-4 py-3 pr-10 focus:outline-none shadow-sm transition-all text-sm ${
                            formTouched.email && !validation.isEmailValid
                              ? "border-red-400 bg-red-50/20 text-red-900 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                              : focusedField === "email" && validation.isEmailValid
                              ? "border-emerald-400 bg-emerald-50/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                              : "border-gray-200 bg-gray-50/50 focus:bg-white focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker"
                          }`}
                        />
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                          {focusedField === "email" && validation.isEmailValid && (
                            <i className="fa-solid fa-circle-check text-emerald-500 text-sm animate-in fade-in duration-150"></i>
                          )}
                          {formTouched.email && !validation.isEmailValid && (
                            <i className="fa-solid fa-circle-exclamation text-red-500 text-sm"></i>
                          )}
                        </div>
                      </div>
                      {formTouched.email && validation.emailError && (
                        <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1.5 font-medium animate-in fade-in duration-200">
                          <i className="fa-solid fa-triangle-exclamation text-[11px] shrink-0"></i>
                          <span>{validation.emailError}</span>
                        </p>
                      )}
                      {focusedField === "email" && validation.isEmailValid && (
                        <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1.5 font-medium animate-in fade-in duration-150">
                          <i className="fa-solid fa-check text-[11px] shrink-0"></i>
                          <span>Email valid dan siap digunakan</span>
                        </p>
                      )}
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-sm font-bold text-gray-700">Kata Sandi (Password)</label>
                        {focusedField === "password" && !editingKaryawan && formPassword && (
                          <span className={`text-[11px] font-semibold flex items-center gap-1 ${validation.isPasswordValid ? 'text-emerald-600' : 'text-amber-600'} animate-in fade-in duration-150`}>
                            {formPassword.length}/6 karakter
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input 
                          type={showPassword ? "text" : "password"} 
                          value={formPassword} 
                          onChange={(e) => { setFormPassword(e.target.value); markTouched("password"); }}
                          onFocus={() => setFocusedField("password")}
                          onBlur={() => { markTouched("password"); setFocusedField(null); }}
                          autoComplete="new-password"
                          minLength={6}
                          placeholder={editingKaryawan ? "Ketik untuk mengubah sandi" : "Minimal 6 karakter"}
                          className={`w-full border rounded-xl px-4 py-3 pr-20 focus:outline-none shadow-sm transition-all text-sm ${
                            formTouched.password && !validation.isPasswordValid
                              ? "border-amber-400 bg-amber-50/20 text-amber-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                              : focusedField === "password" && formPassword && validation.isPasswordValid
                              ? "border-emerald-400 bg-emerald-50/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                              : "border-gray-200 bg-gray-50/50 focus:bg-white focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker"
                          }`}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                          {focusedField === "password" && formPassword && validation.isPasswordValid && (
                            <i className="fa-solid fa-circle-check text-emerald-500 text-sm animate-in fade-in duration-150"></i>
                          )}
                          {formTouched.password && !validation.isPasswordValid && (
                            <i className="fa-solid fa-circle-exclamation text-amber-500 text-sm"></i>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-gray-400 hover:text-gray-600 p-1 focus:outline-none transition-colors"
                            title={showPassword ? "Sembunyikan sandi" : "Lihat sandi"}
                          >
                            <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                          </button>
                        </div>
                      </div>
                      {formTouched.password && validation.passwordError && (
                        <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1.5 font-medium animate-in fade-in duration-200">
                          <i className="fa-solid fa-circle-info text-[11px] shrink-0 text-amber-500"></i>
                          <span>{validation.passwordError}</span>
                        </p>
                      )}
                      {focusedField === "password" && formPassword && validation.isPasswordValid && (
                        <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1.5 font-medium animate-in fade-in duration-150">
                          <i className="fa-solid fa-check text-[11px] shrink-0"></i>
                          <span>Kata sandi memenuhi syarat</span>
                        </p>
                      )}
                      {editingKaryawan && !formPassword && (
                        <p className="text-[11px] text-gray-400 mt-1">Kosongkan jika tidak ingin mengubah kata sandi akun</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Informasi Pekerjaan */}
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2 flex items-center"><i className="fa-solid fa-briefcase mr-2"></i> 3. Informasi Pekerjaan</h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Posisi / Jabatan</label>
                      <CustomSelect 
                        value={formPosisi}
                        onChange={(val) => setFormPosisi(val)}
                        options={positionOptions}
                        actionButton={{
                          label: "Tambah Posisi Baru...",
                          onClick: () => {
                            setNewPositionName("");
                            setPositionModalError("");
                            setShowAddPositionModal(true);
                          }
                        }}
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
                <button 
                  type="submit" 
                  disabled={isSavingKaryawan}
                  className={`bg-pilar-darker text-pilar-gold font-bold px-8 py-3 rounded-xl shadow-md hover:bg-black hover:shadow-lg focus:ring-4 focus:ring-pilar-darker/20 transition-all flex items-center space-x-2 ${isSavingKaryawan ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isSavingKaryawan ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-save"></i>
                      <span>Simpan</span>
                    </>
                  )}
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
            {spList.filter(s => s.status === "Aktif" && !s.isAcknowledged).length > 0 && (
              <span className="ml-auto px-1.5 py-0.5 text-[9px] font-black rounded-full bg-amber-500 text-pilar-darker">
                {spList.filter(s => s.status === "Aktif" && !s.isAcknowledged).length}
              </span>
            )}
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
          <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
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
             activeMenu === "karyawan" ? (karyawanSubTab === "sp" ? "Manajemen Surat Peringatan (SP)" : "Manajemen Karyawan") :
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
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${isSuperAdmin ? 'bg-pilar-darker text-pilar-gold ring-2 ring-pilar-gold/40 text-sm' : 'bg-pilar-darker text-pilar-gold text-sm'}`}>
                {isSuperAdmin ? (
                  <i className="fa-solid fa-crown text-xs text-pilar-gold"></i>
                ) : (
                  (currentAdminName.charAt(0) || 'A').toUpperCase()
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-gray-800 leading-tight truncate max-w-[150px]">{currentAdminName}</p>
                  {isSuperAdmin && (
                    <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-pilar-darker text-pilar-gold border border-pilar-gold/30 flex items-center gap-0.5 shadow-2xs">
                      <i className="fa-solid fa-crown text-[8px] text-pilar-gold"></i> Super Admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{isSuperAdmin ? "Master Administrator" : "HR Manager"}</p>
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

          {/* KELOLA KARYAWAN TAB (DAFTAR KARYAWAN & SURAT PERINGATAN) */}
          {activeMenu === "karyawan" && (
            <div className="space-y-6 animate-slide-up">
              {/* Sub-tab Navigation */}
              <div className="bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 flex items-center space-x-2 max-w-xl">
                <button
                  type="button"
                  onClick={() => setKaryawanSubTab("karyawan")}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2 ${
                    karyawanSubTab === "karyawan"
                      ? "bg-pilar-darker text-pilar-gold shadow-md"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <i className="fa-solid fa-users-gear"></i>
                  <span>Daftar Karyawan</span>
                </button>

                <button
                  type="button"
                  onClick={() => setKaryawanSubTab("sp")}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2 relative ${
                    karyawanSubTab === "sp"
                      ? "bg-pilar-darker text-pilar-gold shadow-md"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  <span>Surat Peringatan (SP)</span>
                  {spList.filter(s => s.status === "Aktif" && !s.isAcknowledged).length > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-amber-500 text-pilar-darker shadow-sm">
                      {spList.filter(s => s.status === "Aktif" && !s.isAcknowledged).length}
                    </span>
                  )}
                </button>
              </div>

              {/* Sub-tab 1: Daftar Karyawan (CRUD Table) */}
              {karyawanSubTab === "karyawan" && (
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

              {/* Sub-tab 2: Surat Peringatan (SP) */}
              {karyawanSubTab === "sp" && (
<div className="space-y-8 animate-slide-up">
              {/* 4 Stat Cards - 3 Colors (Navy, Gold, Gray) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Diterbitkan */}
                <div className="group bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60 flex flex-col justify-between hover:-translate-y-1 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-pilar-gold/10 rounded-full blur-3xl -mr-10 -mt-10 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-start z-10">
                    <div className="w-14 h-14 bg-pilar-darker text-pilar-gold rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-gray-200 transform group-hover:scale-110 transition-transform duration-300">
                      <i className="fa-solid fa-folder-open"></i>
                    </div>
                    <span className="bg-gray-100 text-pilar-darker text-xs font-bold px-3 py-1 rounded-full">Arsip</span>
                  </div>
                  <div className="mt-6 z-10">
                    <p className="text-sm text-gray-500 font-medium mb-1">Total SP Diterbitkan</p>
                    <p className="text-4xl font-black text-gray-800 tracking-tight">{spList.length}</p>
                  </div>
                </div>

                {/* SP Aktif */}
                <div className="group bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60 flex flex-col justify-between hover:-translate-y-1 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-pilar-gold/10 rounded-full blur-3xl -mr-10 -mt-10 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-start z-10">
                    <div className="w-14 h-14 bg-pilar-gold text-pilar-darker rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-gray-200 transform group-hover:scale-110 transition-transform duration-300">
                      <i className="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <span className="bg-pilar-gold/15 text-pilar-darker text-xs font-bold px-3 py-1 rounded-full">Aktif</span>
                  </div>
                  <div className="mt-6 z-10">
                    <p className="text-sm text-gray-500 font-medium mb-1">SP Masih Berlaku</p>
                    <p className="text-4xl font-black text-gray-800 tracking-tight">
                      {spList.filter(s => s.status === "Aktif").length}
                    </p>
                  </div>
                </div>

                {/* Menunggu Respon */}
                <div className="group bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60 flex flex-col justify-between hover:-translate-y-1 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gray-100 rounded-full blur-3xl -mr-10 -mt-10 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-start z-10">
                    <div className="w-14 h-14 bg-gray-100 text-gray-700 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-gray-200 transform group-hover:scale-110 transition-transform duration-300">
                      <i className="fa-solid fa-user-clock"></i>
                    </div>
                    <span className="bg-gray-100 text-gray-700 text-xs font-bold px-3 py-1 rounded-full">Pending</span>
                  </div>
                  <div className="mt-6 z-10">
                    <p className="text-sm text-gray-500 font-medium mb-1">Menunggu Respon Karyawan</p>
                    <p className="text-4xl font-black text-gray-800 tracking-tight">
                      {spList.filter(s => s.status === "Aktif" && !s.isAcknowledged).length}
                    </p>
                  </div>
                </div>

                {/* Selesai / Nonaktif */}
                <div className="group bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60 flex flex-col justify-between hover:-translate-y-1 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-pilar-gold/10 rounded-full blur-3xl -mr-10 -mt-10 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-start z-10">
                    <div className="w-14 h-14 bg-pilar-darker text-pilar-gold rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-gray-200 transform group-hover:scale-110 transition-transform duration-300">
                      <i className="fa-solid fa-circle-check"></i>
                    </div>
                    <span className="bg-gray-100 text-pilar-darker text-xs font-bold px-3 py-1 rounded-full">Selesai</span>
                  </div>
                  <div className="mt-6 z-10">
                    <p className="text-sm text-gray-500 font-medium mb-1">Selesai / Masa Habis</p>
                    <p className="text-4xl font-black text-gray-800 tracking-tight">
                      {spList.filter(s => s.status === "Selesai" || s.status === "Dibatalkan").length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Main Card: Search, Filter & Floating Row Table */}
              <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60 overflow-hidden">
                {/* Header / Filter Toolbar */}
                <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row md:justify-between md:items-center bg-gray-50/50 gap-4">
                  <div className="flex flex-col md:flex-row items-center space-y-3 md:space-y-0 md:space-x-4 w-full md:w-auto flex-1">
                    <div className="relative w-full md:w-72">
                      <input
                        type="text"
                        value={spSearchQuery}
                        onChange={(e) => setSpSearchQuery(e.target.value)}
                        placeholder="Cari nama, NIK, atau nomor SP..."
                        className="w-full border border-gray-200 rounded-xl pl-11 pr-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all bg-white"
                      />
                      <i className="fa-solid fa-search absolute left-4 top-3 text-gray-400"></i>
                    </div>

                    <div className="flex items-center space-x-3 w-full md:w-auto">
                      <select
                        value={spFilterTingkat}
                        onChange={(e) => setSpFilterTingkat(e.target.value)}
                        className="w-full md:w-auto border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all bg-white"
                      >
                        <option value="all">Semua Tingkat SP</option>
                        <option value="Surat Teguran">Surat Teguran</option>
                        <option value="SP 1">SP 1</option>
                        <option value="SP 2">SP 2</option>
                        <option value="SP 3">SP 3</option>
                      </select>

                      <select
                        value={spFilterStatus}
                        onChange={(e) => setSpFilterStatus(e.target.value)}
                        className="w-full md:w-auto border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all bg-white"
                      >
                        <option value="all">Semua Status</option>
                        <option value="Aktif">Aktif</option>
                        <option value="Selesai">Selesai</option>
                        <option value="Dibatalkan">Dibatalkan</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 w-full md:w-auto">
                    <button
                      type="button"
                      onClick={handleOpenAddSpModal}
                      className="w-full md:w-auto bg-pilar-darker hover:bg-black text-pilar-gold font-bold px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg focus:ring-4 focus:ring-pilar-darker/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <i className="fa-solid fa-file-circle-plus"></i>
                      <span>Terbitkan SP Baru</span>
                    </button>
                  </div>
                </div>

                {/* Table with Floating Rows */}
                <div className="overflow-x-auto p-6 -mt-2">
                  {(() => {
                    const filtered = spList.filter(s => {
                      const matchSearch = !spSearchQuery.trim() || 
                        (s.karyawanNama || "").toLowerCase().includes(spSearchQuery.toLowerCase()) ||
                        (s.karyawanNik || "").toLowerCase().includes(spSearchQuery.toLowerCase()) ||
                        (s.nomorSurat || "").toLowerCase().includes(spSearchQuery.toLowerCase()) ||
                        (s.alasanPelanggaran || "").toLowerCase().includes(spSearchQuery.toLowerCase());
                      const matchTingkat = spFilterTingkat === "all" || s.tingkatSp === spFilterTingkat;
                      const matchStatus = spFilterStatus === "all" || s.status === spFilterStatus;
                      return matchSearch && matchTingkat && matchStatus;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="py-16 text-center">
                          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                            <i className="fa-solid fa-folder-open text-3xl text-gray-300"></i>
                          </div>
                          <p className="text-gray-500 font-medium text-lg">Tidak ada Surat Peringatan ditemukan</p>
                          <p className="text-xs text-gray-400 mt-1">Belum ada data SP yang sesuai kriteria pencarian saat ini.</p>
                        </div>
                      );
                    }

                    return (
                      <table className="w-full text-left text-sm whitespace-nowrap border-separate" style={{ borderSpacing: "0 16px" }}>
                        <thead>
                          <tr className="text-gray-500 font-semibold">
                            <th className="px-6 py-2 font-medium">Nomor & Tanggal</th>
                            <th className="px-6 py-2 font-medium">Karyawan</th>
                            <th className="px-6 py-2 font-medium">Tingkat Sanksi</th>
                            <th className="px-6 py-2 font-medium">Alasan Pelanggaran</th>
                            <th className="px-6 py-2 font-medium">Masa Berlaku</th>
                            <th className="px-6 py-2 font-medium text-center">Tanda Terima</th>
                            <th className="px-6 py-2 font-medium text-center">Status</th>
                            <th className="px-6 py-2 font-medium text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((sp) => {
                            const emp = karyawanList.find(k => k.id === sp.karyawanId || k.nama === sp.karyawanNama || (k as any).noInduk === sp.karyawanNik);
                            const foto = emp?.foto;

                            return (
                              <tr key={sp.id} className="group transition-all duration-300 hover:-translate-y-1 relative z-10">
                                {/* Nomor & Tanggal */}
                                <td className="px-6 py-5 bg-white rounded-l-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-l border-gray-100 group-hover:border-pilar-gold/40 transition-all">
                                  <div className="font-mono font-extrabold text-gray-800 text-sm">{sp.nomorSurat}</div>
                                  <div className="text-xs text-gray-400 mt-1 flex items-center gap-1.5 font-medium">
                                    <i className="fa-solid fa-calendar-days text-[11px] text-gray-400"></i>
                                    <span>{sp.tanggalTerbit}</span>
                                  </div>
                                </td>

                                {/* Karyawan (dengan Avatar) */}
                                <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all">
                                  <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gray-50 overflow-hidden flex items-center justify-center font-black text-pilar-darker border border-gray-100 shadow-inner group-hover:border-pilar-gold/40 transition-colors shrink-0">
                                      {foto ? (
                                        <img src={foto} alt={sp.karyawanNama} className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="group-hover:text-pilar-gold transition-colors text-sm">
                                          {sp.karyawanNama ? sp.karyawanNama.substring(0, 2).toUpperCase() : "??"}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-col justify-center">
                                      <div className="font-extrabold text-gray-800 text-base">{sp.karyawanNama}</div>
                                      <div className="text-[11px] text-gray-500 mt-0.5 font-semibold tracking-wide">
                                        {sp.karyawanPosisi || "Karyawan"} • NIK: {sp.karyawanNik || "-"}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Tingkat SP - 3 Colors: Navy, Gold, Gray */}
                                <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all">
                                  <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm border inline-block ${
                                    sp.tingkatSp === "Surat Teguran" ? "bg-gray-100 text-gray-700 border-gray-200" :
                                    sp.tingkatSp === "SP 1" ? "bg-pilar-gold/15 text-pilar-darker border-pilar-gold/30" :
                                    sp.tingkatSp === "SP 2" ? "bg-pilar-gold text-pilar-darker border-pilar-gold" :
                                    "bg-pilar-darker text-pilar-gold border-pilar-darker"
                                  }`}>
                                    {sp.tingkatSp}
                                  </span>
                                </td>

                                {/* Alasan Pelanggaran */}
                                <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all max-w-xs">
                                  <p className="font-semibold text-gray-800 text-sm truncate" title={sp.alasanPelanggaran}>{sp.alasanPelanggaran}</p>
                                  {sp.detailPelanggaran && (
                                    <p className="text-xs text-gray-400 mt-0.5 truncate" title={sp.detailPelanggaran}>{sp.detailPelanggaran}</p>
                                  )}
                                </td>

                                {/* Masa Berlaku */}
                                <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all">
                                  <div className="text-xs text-gray-500 font-medium">{sp.berlakuMulai} s/d</div>
                                  <div className="font-extrabold text-gray-800 text-sm mt-0.5">{sp.berlakuSampai}</div>
                                </td>

                                {/* Tanda Terima - Navy & Gray */}
                                <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-center">
                                  {sp.isAcknowledged ? (
                                    <span className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest bg-pilar-darker text-pilar-gold border border-pilar-darker inline-flex items-center gap-1.5 shadow-sm">
                                      <i className="fa-solid fa-circle-check text-xs"></i>
                                      <span>Diterima</span>
                                    </span>
                                  ) : (
                                    <span className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest bg-gray-100 text-gray-600 border border-gray-200 inline-flex items-center gap-1.5 shadow-sm">
                                      <i className="fa-solid fa-clock text-xs"></i>
                                      <span>Menunggu</span>
                                    </span>
                                  )}
                                </td>

                                {/* Status - Gold & Gray */}
                                <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-center">
                                  <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm border ${
                                    sp.status === "Aktif" ? "bg-pilar-gold/20 text-pilar-darker border-pilar-gold/30 font-black" :
                                    "bg-gray-100 text-gray-600 border-gray-200 font-bold"
                                  }`}>
                                    {sp.status}
                                  </span>
                                </td>

                                {/* Aksi - Navy, Gold, Gray */}
                                <td className="px-6 py-5 bg-white rounded-r-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-r border-gray-100 group-hover:border-pilar-gold/40 transition-all text-right">
                                  <div className="flex items-center justify-end space-x-2">
                                    <button 
                                      type="button" 
                                      onClick={() => setSelectedSpDetail(sp)}
                                      className="inline-flex items-center space-x-2 px-3.5 py-2 bg-pilar-darker hover:bg-black text-pilar-gold font-bold rounded-xl text-xs transition-all shadow-md hover:shadow-lg focus:ring-4 focus:ring-pilar-darker/20 cursor-pointer"
                                      title="Lihat Detail Pemberitahuan SP"
                                    >
                                      <i className="fa-solid fa-eye text-xs"></i>
                                      <span>Detail</span>
                                    </button>

                                    {sp.status === "Aktif" && (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateSpStatus(sp.id!, "Selesai")}
                                        className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-pilar-gold text-gray-600 hover:text-pilar-darker border border-gray-200 transition-all flex items-center justify-center cursor-pointer shadow-xs"
                                        title="Tandai Sanksi Selesai"
                                      >
                                        <i className="fa-solid fa-check text-xs"></i>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSpToDelete(sp);
                                        setIsDeleteSpModalOpen(true);
                                      }}
                                      className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-pilar-darker text-gray-500 hover:text-pilar-gold border border-gray-200 transition-all flex items-center justify-center cursor-pointer shadow-xs"
                                      title="Hapus Surat Peringatan"
                                    >
                                      <i className="fa-solid fa-trash text-xs"></i>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>
            </div>
              )}
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
                      <tr className="text-gray-500 font-semibold border-b border-gray-100 text-xs uppercase tracking-wider">
                        <th className="px-5 py-3 font-medium">Karyawan</th>
                        <th className="px-5 py-3 text-right font-medium">Gaji Pokok</th>
                        <th className="px-5 py-3 text-center font-medium">Pelanggaran (Denda)</th>
                        <th className="px-5 py-3 text-center font-medium">Ketidakhadiran (No Work)</th>
                        <th className="px-5 py-3 text-right font-medium">BPJS ({bpjsTkRate + bpjsKesRate}%)</th>
                        <th className="px-5 py-3 text-right font-medium">Gaji Bersih</th>
                        <th className="px-5 py-3 text-center font-medium">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {karyawanList.map((k) => {
                        const gajiPokok = k.gajiPokok || 0;
                        
                        // Cari data kehadiran dari matrixLaporan yang sudah terhitung presisi
                        const empMatrix = matrixLaporan.find(m => m.id === k.id || m.nama === k.nama) || { 
                          tlm: 0, tam: 0, tap: 0, a: 0, i: 0, s: 0, c: 0, total: 0 
                        };

                        const tlm = empMatrix.tlm || 0;
                        const tam = empMatrix.tam || 0;
                        const tap = empMatrix.tap || 0;
                        const a = empMatrix.a || 0;
                        const i = empMatrix.i || 0;

                        // 1. Denda Absensi Sesuai Aturan Perusahaan:
                        // TLM = Rp 16.000, TAM = Rp 25.000, TAP = Rp 25.000
                        const dendaTlm = tlm * 16000;
                        const dendaTam = tam * 25000;
                        const dendaTap = tap * 25000;
                        const subtotalDenda = dendaTlm + dendaTam + dendaTap;
                        // Sesuai PP 36/2021: Total denda finansial maksimal 25% dari upah sebulan
                        const maxDenda = Math.round(gajiPokok * 0.25);
                        const totalDenda = Math.min(subtotalDenda, maxDenda);

                        // 2. Potongan Hari Kerja (Prinsip No Work No Pay):
                        // Alpha (A) = Rp 144.818/hari, Izin Pribadi (I) = Rp 144.818/hari
                        const potonganAlpha = a * 144818;
                        const potonganIzin = i * 144818;
                        const totalPotonganKehadiran = potonganAlpha + potonganIzin;

                        // 3. Iuran BPJS Ketenagakerjaan & Kesehatan
                        const isIkutTk = k.bpjsTk !== false;
                        const isIkutKes = k.bpjsKes !== false;
                        const potBpjsTk = isIkutTk ? Math.round(gajiPokok * (bpjsTkRate / 100)) : 0;
                        const potBpjsKes = isIkutKes ? Math.round(gajiPokok * (bpjsKesRate / 100)) : 0;

                        // 4. Total Potongan & Gaji Bersih
                        const totalPotongan = totalDenda + totalPotonganKehadiran + potBpjsTk + potBpjsKes;
                        const gajiBersih = Math.max(0, gajiPokok - totalPotongan);

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
                            
                            {/* Pelanggaran / Denda */}
                            <td className="px-5 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-center">
                              {totalDenda > 0 ? (
                                <div className="inline-flex flex-col items-center gap-1">
                                  <div className="flex items-center gap-1">
                                    {tlm > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-[10px] border border-amber-200" title={`Terlambat Masuk (TLM): ${tlm}x`}>TLM:{tlm}</span>}
                                    {tam > 0 && <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-bold text-[10px] border border-red-200" title={`Tidak Absen Masuk (TAM): ${tam}x`}>TAM:{tam}</span>}
                                    {tap > 0 && <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-bold text-[10px] border border-purple-200" title={`Tidak Absen Pulang (TAP): ${tap}x`}>TAP:{tap}</span>}
                                  </div>
                                  <span className="text-xs font-bold text-red-600">- Rp {new Intl.NumberFormat('id-ID').format(totalDenda)}</span>
                                </div>
                              ) : (
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">Tertib (Rp 0)</span>
                              )}
                            </td>

                            {/* Ketidakhadiran (No Work No Pay) */}
                            <td className="px-5 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-center">
                              {totalPotonganKehadiran > 0 ? (
                                <div className="inline-flex flex-col items-center gap-1">
                                  <div className="flex items-center gap-1">
                                    {a > 0 && <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px] border border-rose-200" title={`Alpha: ${a} hari`}>A:{a}</span>}
                                    {i > 0 && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200" title={`Izin: ${i} hari`}>I:{i}</span>}
                                  </div>
                                  <span className="text-xs font-bold text-red-600">- Rp {new Intl.NumberFormat('id-ID').format(totalPotonganKehadiran)}</span>
                                </div>
                              ) : (
                                <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">0 Hari</span>
                              )}
                            </td>

                            {/* BPJS */}
                            <td className="px-5 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-right font-bold text-gray-500">
                              {(potBpjsTk + potBpjsKes) > 0 ? (
                                <span>- Rp {new Intl.NumberFormat('id-ID').format(potBpjsTk + potBpjsKes)}</span>
                              ) : (
                                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400 font-semibold inline-block">Nonaktif</span>
                              )}
                            </td>
                            
                            {/* Gaji Bersih */}
                            <td className="px-5 py-5 bg-gray-50/50 shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-right font-black text-pilar-darker text-base">
                              Rp {new Intl.NumberFormat('id-ID').format(gajiBersih)}
                            </td>
                            
                            {/* Aksi Bayar */}
                            <td className="px-5 py-5 bg-white rounded-r-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-r border-gray-100 group-hover:border-pilar-gold/40 transition-all text-center">
                              <button 
                                onClick={() => handleBayarGaji(
                                  k.id, 
                                  gajiBersih, 
                                  k.nama, 
                                  gajiPokok, 
                                  potonganAlpha, 
                                  a, 
                                  potBpjsTk, 
                                  potBpjsKes, 
                                  bpjsTkRate, 
                                  bpjsKesRate,
                                  {
                                    tlm,
                                    tam,
                                    tap,
                                    dendaTlm,
                                    dendaTam,
                                    dendaTap,
                                    totalDenda,
                                    izin: i,
                                    potonganIzin,
                                    totalPotonganKehadiran,
                                    totalPotongan
                                  }
                                )}
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
            <div className="space-y-6 animate-slide-up">
              {/* Sub-tab Navigation */}
              <div className="bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 flex items-center space-x-2 max-w-2xl">
                <button
                  type="button"
                  onClick={() => setPengaturanSubTab("lokasi")}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2 ${
                    pengaturanSubTab === "lokasi"
                      ? "bg-pilar-darker text-pilar-gold shadow-md"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <i className="fa-solid fa-map-location-dot"></i>
                  <span>Titik Lokasi & GPS</span>
                </button>

                {/* Sub-tab Kelola Admin: Khusus Super Admin */}
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => setPengaturanSubTab("admins")}
                    className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2 ${
                      pengaturanSubTab === "admins"
                        ? "bg-pilar-darker text-pilar-gold shadow-md"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <i className="fa-solid fa-user-shield"></i>
                    <span>Kelola Admin</span>
                    {adminList.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 text-[10px] bg-pilar-gold text-pilar-darker rounded-full font-black">
                        {adminList.length}
                      </span>
                    )}
                  </button>
                )}

                {/* Sub-tab Audit Log: Khusus Super Admin */}
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => setPengaturanSubTab("audit")}
                    className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2 ${
                      pengaturanSubTab === "audit"
                        ? "bg-pilar-darker text-pilar-gold shadow-md"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <i className="fa-solid fa-shield-halved"></i>
                    <span>Log Aktivitas</span>
                    {auditLogs.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 text-[10px] bg-pilar-gold text-pilar-darker rounded-full font-black">
                        {auditLogs.length}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* Sub-tab 1: LOKASI */}
              {pengaturanSubTab === "lokasi" && (
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

              {/* Sub-tab 2: AUDIT LOGS */}
              {pengaturanSubTab === "audit" && (
                <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60 overflow-hidden animate-slide-up">
                  <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-extrabold text-gray-800 text-xl tracking-tight">Audit Trail Log Aktivitas Admin</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>Realtime</span>
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">Pencatatan transparan seluruh aktivitas sensitif demi akuntabilitas sistem perusahaan.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                      {/* Search Bar */}
                      <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                        <input
                          type="text"
                          value={auditSearch}
                          onChange={(e) => setAuditSearch(e.target.value)}
                          placeholder="Cari admin, target, aksi..."
                          className="w-full sm:w-64 pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-pilar-gold focus:ring-2 focus:ring-pilar-gold/20"
                        />
                      </div>

                      {/* Filter Action */}
                      <select
                        value={auditFilterAction}
                        onChange={(e) => setAuditFilterAction(e.target.value)}
                        className="py-2 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:border-pilar-gold"
                      >
                        <option value="all">Semua Aksi</option>
                        <option value="TAMBAH_KARYAWAN">Tambah Karyawan</option>
                        <option value="UPDATE_KARYAWAN">Update Karyawan</option>
                        <option value="HAPUS_KARYAWAN">Hapus Karyawan</option>
                        <option value="SETUJUI_PENGAJUAN">Setujui Pengajuan</option>
                        <option value="TOLAK_PENGAJUAN">Revisi Pengajuan</option>
                        <option value="BAYAR_GAJI">Pencairan Gaji</option>
                        <option value="MANAJEMEN_LOKASI">Kelola Lokasi</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-8 bg-gray-50/30 min-h-[500px]">
                    <div className="overflow-x-auto -mt-2">
                      <table className="w-full text-left text-sm whitespace-nowrap border-separate" style={{borderSpacing: "0 14px"}}>
                        <thead>
                          <tr className="text-gray-500 font-semibold">
                            <th className="px-6 py-2 font-medium">Waktu</th>
                            <th className="px-6 py-2 font-medium">Admin Pelaksana</th>
                            <th className="px-6 py-2 font-medium">Tindakan / Aksi</th>
                            <th className="px-6 py-2 font-medium">Sasaran / Target</th>
                            <th className="px-6 py-2 font-medium">Rincian Perubahan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAuditLogs.length > 0 ? (
                            filteredAuditLogs.map((log: any) => {
                              const d = new Date(log.timestampIso);
                              const formattedDate = !isNaN(d.getTime()) 
                                ? d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) 
                                : "-";

                              return (
                                <tr key={log.id} className="group transition-all duration-300 hover:-translate-y-0.5 relative z-10">
                                  {/* Waktu */}
                                  <td className="px-6 py-4 bg-white rounded-l-2xl shadow-sm border-y border-l border-gray-100 text-xs font-medium text-gray-500">
                                    <div className="flex items-center space-x-2">
                                      <i className="fa-regular fa-clock text-gray-400"></i>
                                      <span className="font-mono">{formattedDate}</span>
                                    </div>
                                  </td>

                                  {/* Admin */}
                                  <td className="px-6 py-4 bg-white shadow-sm border-y border-gray-100">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-7 h-7 rounded-lg bg-pilar-darker text-pilar-gold flex items-center justify-center text-xs font-bold">
                                        <i className="fa-solid fa-user-shield"></i>
                                      </div>
                                      <div>
                                        <div className="font-bold text-gray-800 text-xs">{log.adminName || "Admin"}</div>
                                        <div className="text-[10px] text-gray-400 font-mono">{log.adminEmail}</div>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Aksi Badge */}
                                  <td className="px-6 py-4 bg-white shadow-sm border-y border-gray-100">
                                    {getActionBadge(log.action)}
                                  </td>

                                  {/* Target */}
                                  <td className="px-6 py-4 bg-white shadow-sm border-y border-gray-100 font-bold text-gray-800 text-xs">
                                    {log.target || "-"}
                                  </td>

                                  {/* Details */}
                                  <td className="px-6 py-4 bg-white rounded-r-2xl shadow-sm border-y border-r border-gray-100 text-xs text-gray-600 max-w-xs truncate" title={log.details}>
                                    {log.details || "-"}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={5} className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                                <div className="w-16 h-16 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center mx-auto mb-3 text-2xl">
                                  <i className="fa-solid fa-shield-halved"></i>
                                </div>
                                <p className="font-bold text-gray-700 text-base">Belum ada riwayat aktivitas admin yang tercatat</p>
                                <p className="text-xs text-gray-400 mt-1">Setiap penambahan karyawan, persetujuan cuti, payroll gaji, dan perubahan lokasi akan otomatis terdokumentasi di sini.</p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 3: KELOLA AKUN ADMIN (Khusus Super Admin) */}
              {pengaturanSubTab === "admins" && isSuperAdmin && (
                <div className="space-y-6 animate-slide-up">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Card 1: Total Admin */}
                    <div className="group bg-white p-5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border border-gray-100/80 flex items-center space-x-3.5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-pilar-gold/5 rounded-full blur-2xl -mr-8 -mt-8 group-hover:bg-pilar-gold/15 transition-colors"></div>
                      <div className="w-12 h-12 bg-pilar-darker text-pilar-gold rounded-xl flex items-center justify-center text-xl shadow-md shadow-pilar-darker/10 group-hover:scale-105 transition-transform shrink-0 relative z-10">
                        <i className="fa-solid fa-users-gear"></i>
                      </div>
                      <div className="min-w-0 relative z-10">
                        <p className="text-xs text-gray-500 font-medium truncate">Total Administrator</p>
                        <p className="text-xl font-bold text-gray-800 tracking-tight mt-0.5">
                          {adminList.length} Akun
                        </p>
                      </div>
                    </div>

                    {/* Card 2: Super Admin */}
                    <div className="group bg-white p-5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border border-gray-100/80 flex items-center space-x-3.5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-pilar-gold/5 rounded-full blur-2xl -mr-8 -mt-8 group-hover:bg-pilar-gold/15 transition-colors"></div>
                      <div className="w-12 h-12 bg-pilar-darker text-pilar-gold rounded-xl flex items-center justify-center text-xl shadow-md shadow-pilar-darker/10 group-hover:scale-105 transition-transform shrink-0 relative z-10">
                        <i className="fa-solid fa-crown"></i>
                      </div>
                      <div className="min-w-0 relative z-10">
                        <p className="text-xs text-gray-500 font-medium truncate">Super Administrator</p>
                        <p className="text-xl font-bold text-gray-800 tracking-tight mt-0.5">
                          {adminList.filter(a => a.role === 'superadmin').length} Akun
                        </p>
                      </div>
                    </div>

                    {/* Card 3: Admin HRD */}
                    <div className="group bg-white p-5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border border-gray-100/80 flex items-center space-x-3.5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-pilar-gold/5 rounded-full blur-2xl -mr-8 -mt-8 group-hover:bg-pilar-gold/15 transition-colors"></div>
                      <div className="w-12 h-12 bg-pilar-darker text-pilar-gold rounded-xl flex items-center justify-center text-xl shadow-md shadow-pilar-darker/10 group-hover:scale-105 transition-transform shrink-0 relative z-10">
                        <i className="fa-solid fa-user-shield"></i>
                      </div>
                      <div className="min-w-0 relative z-10">
                        <p className="text-xs text-gray-500 font-medium truncate">Admin HRD / Operasional</p>
                        <p className="text-xl font-bold text-gray-800 tracking-tight mt-0.5">
                          {adminList.filter(a => a.role !== 'superadmin').length} Akun
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Main Card */}
                  <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60 overflow-hidden">
                    {/* Header */}
                    <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row md:justify-between md:items-center bg-gray-50/50 space-y-4 md:space-y-0">
                      <div>
                        <h3 className="font-extrabold text-gray-800 text-xl tracking-tight">Manajemen Akun Administrator</h3>
                        <p className="text-sm text-gray-500 mt-1">Kelola personil yang memiliki hak akses dashboard dan sistem PT. PILAR.</p>
                      </div>
                      <div className="flex flex-col md:flex-row items-center space-y-3 md:space-y-0 md:space-x-4 w-full md:w-auto">
                        <div className="relative w-full md:w-auto">
                          <input 
                            type="text" 
                            placeholder="Cari admin..." 
                            value={adminSearch}
                            onChange={(e) => setAdminSearch(e.target.value)}
                            className="w-full md:w-64 border border-gray-200 rounded-xl pl-11 pr-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all bg-white" 
                          />
                          <i className="fa-solid fa-search absolute left-4 top-3 text-gray-400"></i>
                        </div>
                        <button 
                          type="button"
                          onClick={handleOpenAddAdmin}
                          className="w-full md:w-auto bg-pilar-darker hover:bg-black text-pilar-gold font-bold px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg focus:ring-4 focus:ring-pilar-darker/20 transition-all flex items-center justify-center space-x-2"
                        >
                          <i className="fa-solid fa-plus text-xs"></i>
                          <span>Tambah Admin</span>
                        </button>
                      </div>
                    </div>

                    {/* Table Container */}
                    <div className="p-8 bg-gray-50/30 min-h-[500px]">
                      <div className="overflow-x-auto -mt-2">
                        <table className="w-full text-left text-sm whitespace-nowrap border-separate" style={{borderSpacing: "0 16px"}}>
                          <thead>
                            <tr className="text-gray-500 font-semibold">
                              <th className="px-6 py-2 font-medium">Administrator</th>
                              <th className="px-6 py-2 font-medium">NIK</th>
                              <th className="px-6 py-2 font-medium">Email Akses</th>
                              <th className="px-6 py-2 font-medium">Tingkat Akses</th>
                              <th className="px-6 py-2 font-medium">Status</th>
                              <th className="px-6 py-2 text-right font-medium">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const filteredAdmins = adminList.filter(adm => {
                                const q = adminSearch.toLowerCase().trim();
                                if (!q) return true;
                                return (adm.nama || "").toLowerCase().includes(q) || (adm.email || "").toLowerCase().includes(q) || (adm.nik || "").toLowerCase().includes(q);
                              });

                              if (filteredAdmins.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={6} className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                                      <div className="w-16 h-16 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center mx-auto mb-3 text-2xl">
                                        <i className="fa-solid fa-user-xmark"></i>
                                      </div>
                                      <p className="font-bold text-gray-700 text-base">Tidak ada akun admin yang sesuai</p>
                                      <p className="text-xs text-gray-400 mt-1">Coba sesuaikan kata kunci pencarian Anda.</p>
                                    </td>
                                  </tr>
                                );
                              }

                              return filteredAdmins.map((adm) => {
                                const isSelf = adm.uid === auth?.currentUser?.uid || adm.email.toLowerCase() === currentAdminEmail.toLowerCase();
                                const isSuper = adm.role === 'superadmin';

                                return (
                                  <tr key={adm.uid} className="group transition-all duration-300 hover:-translate-y-1 relative z-10">
                                    {/* 1. Administrator */}
                                    <td className="px-6 py-5 bg-white rounded-l-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-l border-gray-100 group-hover:border-pilar-gold/40 transition-all">
                                      <div className="flex items-center space-x-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black border shadow-inner transition-colors ${
                                          isSuper 
                                            ? "bg-pilar-darker text-pilar-gold border-pilar-gold/40" 
                                            : "bg-gray-50 text-pilar-darker border-gray-100 group-hover:bg-pilar-darker group-hover:text-pilar-gold"
                                        }`}>
                                          {isSuper ? (
                                            <i className="fa-solid fa-crown text-sm text-pilar-gold"></i>
                                          ) : (
                                            <span>{(adm.nama || "A").substring(0, 2).toUpperCase()}</span>
                                          )}
                                        </div>
                                        <div>
                                          <div className="flex items-center space-x-2">
                                            <span className="font-extrabold text-gray-800 text-base">{adm.nama}</span>
                                            {isSelf && (
                                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                                                Anda
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-xs text-gray-400 mt-0.5">
                                            {isSuper ? "Master Administrator" : "Admin Operasional / HRD"}
                                          </div>
                                        </div>
                                      </div>
                                    </td>

                                    {/* 2. NIK */}
                                    <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-gray-700">
                                      <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-gray-50 text-gray-800 border border-gray-200 shadow-2xs">
                                        <i className="fa-solid fa-id-card text-gray-400 mr-2 text-[11px]"></i>
                                        {adm.nik || "-"}
                                      </span>
                                    </td>

                                    {/* 3. Email */}
                                    <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all text-gray-600 font-medium">
                                      <div className="flex items-center space-x-2">
                                        <i className="fa-regular fa-envelope text-gray-400"></i>
                                        <span className="font-mono text-xs">{adm.email}</span>
                                      </div>
                                    </td>

                                    {/* 4. Tingkat Akses */}
                                    <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all">
                                      {isSuper ? (
                                        <span className="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-pilar-darker text-pilar-gold border border-pilar-gold/30 inline-flex items-center space-x-1.5 shadow-xs">
                                          <i className="fa-solid fa-crown text-pilar-gold text-xs"></i>
                                          <span>Super Admin</span>
                                        </span>
                                      ) : (
                                        <span className="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-700 border border-gray-200 inline-flex items-center space-x-1.5">
                                          <i className="fa-solid fa-shield text-gray-400 text-xs"></i>
                                          <span>Admin HRD</span>
                                        </span>
                                      )}
                                    </td>

                                    {/* 5. Status */}
                                    <td className="px-6 py-5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-gray-100 group-hover:border-y-pilar-gold/40 transition-all">
                                      <span className="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-700 border border-gray-200 inline-flex items-center space-x-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-pilar-darker"></span>
                                        <span>Aktif</span>
                                      </span>
                                    </td>

                                    {/* 6. Aksi */}
                                    <td className="px-6 py-5 bg-white rounded-r-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] group-hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] border-y border-r border-gray-100 group-hover:border-pilar-gold/40 transition-all">
                                      <div className="flex justify-end space-x-2">
                                        <button 
                                          type="button"
                                          onClick={() => handleOpenEditAdmin(adm)}
                                          title="Edit Akun Admin"
                                          className="w-9 h-9 rounded-xl bg-gray-50 text-gray-500 hover:text-pilar-darker hover:bg-white border border-gray-100 hover:border-gray-200 shadow-sm flex items-center justify-center transition-all cursor-pointer"
                                        >
                                          <i className="fa-solid fa-pen text-sm"></i>
                                        </button>
                                        <button 
                                          type="button"
                                          disabled={isSelf}
                                          onClick={() => handleOpenDeleteAdmin(adm)}
                                          title={isSelf ? "Tidak dapat menghapus akun Anda sendiri" : "Hapus Akun Admin"}
                                          className={`w-9 h-9 rounded-xl border shadow-sm flex items-center justify-center transition-all ${
                                            isSelf
                                              ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
                                              : "bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-white border-gray-100 hover:border-red-100 cursor-pointer"
                                          }`}
                                        >
                                          <i className="fa-solid fa-trash text-sm"></i>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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

      {/* Confirmation Modal (Standardized) */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200 p-8 text-center relative">
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none ${
              confirmModal.variant === "primary" ? "bg-pilar-gold/15" : "bg-red-500/10"
            }`}></div>
            
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner border relative z-10 ${
              confirmModal.variant === "primary" 
                ? "bg-pilar-darker text-pilar-gold border-pilar-gold/20" 
                : "bg-red-50 text-red-600 border-red-100"
            }`}>
              <i className={confirmModal.icon || (confirmModal.variant === "primary" ? "fa-solid fa-money-bill-wave" : "fa-solid fa-trash-can")}></i>
            </div>

            <h3 className="font-extrabold text-gray-900 text-xl tracking-tight mb-2 relative z-10">
              {confirmModal.title || "Konfirmasi Tindakan"}
            </h3>

            <p className="text-gray-500 text-sm leading-relaxed mb-6 relative z-10">
              {confirmModal.message}
            </p>

            <div className="flex items-center justify-center gap-3 relative z-10">
              <button 
                type="button"
                onClick={() => setConfirmModal(null)} 
                className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-50 transition-all cursor-pointer"
              >
                {confirmModal.cancelText || "Batal"}
              </button>
              <button 
                type="button"
                onClick={confirmModal.onConfirm} 
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  confirmModal.variant === "primary"
                    ? "bg-pilar-darker hover:bg-black text-pilar-gold focus:ring-4 focus:ring-pilar-darker/20"
                    : "bg-red-600 hover:bg-red-700 text-white focus:ring-4 focus:ring-red-600/20"
                }`}
              >
                {confirmModal.confirmText || "Ya, Lanjutkan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal (Standardized) */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200 p-8 text-center relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner border border-amber-100 relative z-10">
              <i className="fa-solid fa-rotate-left"></i>
            </div>
            <h3 className="font-extrabold text-gray-900 text-xl tracking-tight mb-2 relative z-10">Kembalikan untuk Direvisi</h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-4 relative z-10">
              Berikan catatan alasan mengapa permohonan ini dikembalikan atau dokumen apa yang perlu dilengkapi.
            </p>

            <div className="mb-6 relative z-10 text-left">
              <textarea 
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Misal: Mohon lampirkan surat keterangan dokter asli / foto lebih jelas..."
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker text-sm shadow-sm transition-all resize-none bg-gray-50/50"
              ></textarea>
            </div>

            <div className="flex items-center justify-center gap-3 relative z-10">
              <button 
                type="button"
                onClick={() => setRejectModalOpen(false)} 
                className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-50 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button 
                type="button"
                onClick={handleRejectSubmit} 
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md hover:shadow-lg focus:ring-4 focus:ring-red-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-paper-plane text-xs"></i>
                <span>Kirim Revisi</span>
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
              <div className="border-b-2 border-pilar-darker pb-4 mb-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src="https://res.cloudinary.com/sgcxykbd/image/upload/v1789396132/Surat_Peringatan_2_Jufrianto_1_-1.png" 
                  alt="Logo PT. Pilar Sentra Solusi" 
                  className="h-[73px] object-contain" 
                  onError={(e) => { e.currentTarget.src = '/logo-pilar.png'; }}
                />
              </div>

              {/* JUDUL FORMULIR */}
              <div className="text-center my-6">
                <h2 className="text-lg font-black uppercase tracking-wider text-pilar-darker border-b-2 border-pilar-gold inline-block pb-1">
                  FORMULIR PENGAJUAN CUTI & IZIN KARYAWAN
                </h2>
                <p className="text-xs text-gray-500 mt-1">Dokumen Resmi Pengajuan Ketidakhadiran</p>
              </div>

              {/* INFORMASI PEGAWAI */}
              <div className="mb-6">
                <div className="bg-[#114289] text-white font-bold px-4 py-2 text-xs uppercase tracking-wider rounded-t-xl" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
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
                <div className="bg-[#114289] text-white font-bold px-4 py-2 text-xs uppercase tracking-wider rounded-t-xl" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                  B. Detail Pengajuan
                </div>
                <div className="border border-gray-300 border-t-0 rounded-b-xl p-4 text-xs bg-white">
                  <div className="font-bold text-gray-800 mb-2.5">Kategori / Jenis Pengajuan:</div>
                  <div className="mb-5 p-3 bg-gray-50 rounded-lg border border-gray-200 inline-block min-w-[200px]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded border flex items-center justify-center font-bold text-xs bg-[#114289] border-[#114289] text-white">
                        ✓
                      </div>
                      <span className="font-bold text-gray-900">
                        {selectedPengajuan.type}
                      </span>
                    </div>
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
              <div className={`grid ${selectedPengajuan.delegationName && selectedPengajuan.delegationName !== "__________________" ? "grid-cols-2" : "grid-cols-1"} gap-6 mb-8`}>
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

                {selectedPengajuan.delegationName && selectedPengajuan.delegationName !== "__________________" && (
                  <div className="border border-gray-300 rounded-xl overflow-hidden">
                    <div className="bg-gray-100 border-b border-gray-300 font-bold px-4 py-2 text-xs text-gray-700 uppercase tracking-wider">
                      D. Pelimpahan Tugas
                    </div>
                    <div className="p-4 space-y-3 text-xs bg-white min-h-[100px]">
                      <div className="grid grid-cols-[80px_auto_1fr] gap-2 border-b border-gray-100 pb-1.5">
                        <span className="text-gray-500 font-medium">Nama</span>
                        <span className="text-gray-400">:</span>
                        <span className="font-bold text-gray-900">{selectedPengajuan.delegationName}</span>
                      </div>
                      <div className="grid grid-cols-[80px_auto_1fr] gap-2 border-b border-gray-100 pb-1.5">
                        <span className="text-gray-500 font-medium">No. Induk (NIK)</span>
                        <span className="text-gray-400">:</span>
                        <span className="font-mono font-bold text-gray-800">
                          {(() => {
                            const emp = karyawanList.find(k => k.id === selectedPengajuan.delegationId || k.nama === selectedPengajuan.delegationName);
                            return selectedPengajuan.delegationNik || emp?.noInduk || "-";
                          })()}
                        </span>
                      </div>
                      <div className="grid grid-cols-[80px_auto_1fr] gap-2 border-b border-gray-100 pb-1.5">
                        <span className="text-gray-500 font-medium">Jabatan</span>
                        <span className="text-gray-400">:</span>
                        <span className="font-medium text-gray-800">{selectedPengajuan.delegationRole || "-"}</span>
                      </div>
                      <div className="mt-4 pt-2 text-[10px] text-gray-400 leading-tight">
                        *Dengan ini penerima wewenang bersedia mengambil alih tanggung jawab pekerjaan selama pemohon tidak hadir.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* TANDA TANGAN */}
              <div className={`grid ${selectedPengajuan.delegationName && selectedPengajuan.delegationName !== "__________________" ? "grid-cols-3" : "grid-cols-2 max-w-2xl mx-auto"} gap-6 text-center text-xs mt-10`}>
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <p className="text-gray-600 font-medium mb-1">Diajukan Oleh,</p>
                    <p className="text-[10px] text-gray-400 mb-16">Tanggal: {selectedPengajuan.createdAt ? new Date(selectedPengajuan.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : "__________________"}</p>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 border-b border-gray-400 pb-1 mx-auto w-4/5 uppercase">
                      {selectedPengajuan.karyawanNama}
                    </p>
                    <p className="text-gray-700 font-mono text-[11px] mt-1 font-semibold">
                      {(() => {
                        const emp = karyawanList.find(k => k.id === selectedPengajuan.karyawanId || k.nama === selectedPengajuan.karyawanNama);
                        const nik = selectedPengajuan.karyawanNik || emp?.noInduk;
                        return nik ? `NIK: ${nik}` : "NIK: -";
                      })()}
                    </p>
                    <p className="text-gray-500 text-[10px]">{selectedPengajuan.karyawanPosisi}</p>
                  </div>
                </div>
                
                {selectedPengajuan.delegationName && selectedPengajuan.delegationName !== "__________________" && (
                  <div className="flex flex-col h-full justify-between">
                    <div>
                      <p className="text-gray-600 font-medium mb-1">Penerima Pelimpahan Tugas,</p>
                      <p className="text-[10px] text-gray-400 mb-16">Tanggal: __________________</p>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 border-b border-gray-400 pb-1 mx-auto w-4/5">
                        {selectedPengajuan.delegationName}
                      </p>
                      <p className="text-gray-700 font-mono text-[11px] mt-1 font-semibold">
                        {(() => {
                          const emp = karyawanList.find(k => k.id === selectedPengajuan.delegationId || k.nama === selectedPengajuan.delegationName);
                          const nik = selectedPengajuan.delegationNik || emp?.noInduk;
                          return nik ? `NIK: ${nik}` : "NIK: -";
                        })()}
                      </p>
                      <p className="text-gray-500 text-[10px]">{selectedPengajuan.delegationRole || "-"}</p>
                    </div>
                  </div>
                )}

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
                    <p className="font-bold text-gray-900 border-b border-gray-400 pb-1 mx-auto w-4/5 uppercase">
                      {selectedPengajuan.approverNama || currentAdminName || "PT. PILAR SENTRA SOLUSI"}
                    </p>
                    <p className="text-gray-700 font-mono text-[11px] mt-1 font-semibold">
                      {(selectedPengajuan.approverNik || currentAdminNik) ? `NIK: ${selectedPengajuan.approverNik || currentAdminNik}` : "HRD & Personalia"}
                    </p>
                    <p className="text-gray-500 text-[10px]">HR Manager / Direktur</p>
                  </div>
                </div>
              </div>

              {/* FOOTER BAR DOKUMEN */}
              <div 
                className="mt-14 px-4 py-2.5 bg-[#114289] text-white flex flex-wrap sm:flex-nowrap items-center justify-between text-[10px] md:text-[11px] gap-3"
                style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
              >
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-location-dot text-xs shrink-0"></i>
                  <span>Jalan Hamadun gailea, Fagudu, Kepulauan Sula, Maluku Utara</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-envelope text-xs shrink-0"></i>
                  <span>pilarsentrasolusi@gmail.com</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-phone text-xs shrink-0"></i>
                  <span>0822-1037-1774</span>
                </div>
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
            <div className="border-b-2 border-pilar-darker pb-4 mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="https://res.cloudinary.com/sgcxykbd/image/upload/v1789396132/Surat_Peringatan_2_Jufrianto_1_-1.png" 
                alt="Logo PT. Pilar Sentra Solusi" 
                className="h-[73px] object-contain" 
                onError={(e) => { e.currentTarget.src = '/logo-pilar.png'; }}
              />
            </div>

            {/* JUDUL SLIP GAJI */}
            <div className="text-center my-6">
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
                  <span className="text-gray-600 font-medium">NIK Karyawan</span>
                  <span className="text-gray-400">:</span>
                  <span className="font-mono font-bold text-gray-800">{getAdminSlipPenerima(selectedAdminSlip).nik}</span>
                </div>
                <div className="grid grid-cols-[120px_auto_1fr] gap-2">
                  <span className="text-gray-600 font-medium">Jabatan / Posisi</span>
                  <span className="text-gray-400">:</span>
                  <span className="font-bold text-gray-800">{getAdminSlipPenerima(selectedAdminSlip).jabatan}</span>
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
                <div className="bg-[#114289] text-white font-bold px-4 py-2.5 text-xs uppercase tracking-wider flex justify-between items-center" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
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
                <div className="bg-[#114289] text-white font-bold px-4 py-2.5 text-xs uppercase tracking-wider flex justify-between items-center" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                  <span>B. Potongan (Deductions)</span>
                  <i className="fa-solid fa-circle-minus text-xs"></i>
                </div>
                <div className="p-4 space-y-2 text-xs">
                  {/* Denda Keterlambatan Masuk (TLM) */}
                  {(selectedAdminSlip.tlm || 0) > 0 && (
                    <div className="flex justify-between items-center py-1 border-b border-gray-100">
                      <span className="text-gray-700">Terlambat Masuk (TLM: {selectedAdminSlip.tlm}x)</span>
                      <span className="font-bold text-red-600">
                        - Rp {new Intl.NumberFormat('id-ID').format(selectedAdminSlip.dendaTlm || (selectedAdminSlip.tlm * 16000))}
                      </span>
                    </div>
                  )}

                  {/* Denda Tidak Absen Masuk (TAM) */}
                  {(selectedAdminSlip.tam || 0) > 0 && (
                    <div className="flex justify-between items-center py-1 border-b border-gray-100">
                      <span className="text-gray-700">Tidak Absen Masuk (TAM: {selectedAdminSlip.tam}x)</span>
                      <span className="font-bold text-red-600">
                        - Rp {new Intl.NumberFormat('id-ID').format(selectedAdminSlip.dendaTam || (selectedAdminSlip.tam * 25000))}
                      </span>
                    </div>
                  )}

                  {/* Denda Tidak Absen Pulang (TAP) */}
                  {(selectedAdminSlip.tap || 0) > 0 && (
                    <div className="flex justify-between items-center py-1 border-b border-gray-100">
                      <span className="text-gray-700">Tidak Absen Pulang (TAP: {selectedAdminSlip.tap}x)</span>
                      <span className="font-bold text-red-600">
                        - Rp {new Intl.NumberFormat('id-ID').format(selectedAdminSlip.dendaTap || (selectedAdminSlip.tap * 25000))}
                      </span>
                    </div>
                  )}

                  {/* Potongan Alpha (A) */}
                  <div className="flex justify-between items-center py-1 border-b border-gray-100">
                    <span className="text-gray-700">Alpha / Tanpa Ket. (A: {selectedAdminSlip.alpa || 0} Hari)</span>
                    <span className={(selectedAdminSlip.potonganAlpa || 0) > 0 ? "font-bold text-red-600" : "text-gray-500"}>
                      {(selectedAdminSlip.potonganAlpa || 0) > 0 
                        ? `- Rp ${new Intl.NumberFormat('id-ID').format(selectedAdminSlip.potonganAlpa!)}` 
                        : "Rp 0"}
                    </span>
                  </div>

                  {/* Potongan Izin Pribadi (I) */}
                  {(selectedAdminSlip.izin || 0) > 0 && (
                    <div className="flex justify-between items-center py-1 border-b border-gray-100">
                      <span className="text-gray-700">Izin Pribadi (I: {selectedAdminSlip.izin} Hari)</span>
                      <span className="font-bold text-red-600">
                        - Rp {new Intl.NumberFormat('id-ID').format(selectedAdminSlip.potonganIzin || (selectedAdminSlip.izin * 144818))}
                      </span>
                    </div>
                  )}

                  {/* BPJS Ketenagakerjaan */}
                  <div className="flex justify-between items-center py-1 border-b border-gray-100">
                    <span className="text-gray-700">BPJS Ketenagakerjaan ({selectedAdminSlip.bpjsTkRate ?? 2}%)</span>
                    <span className={(selectedAdminSlip.potonganBpjsTk || 0) > 0 ? "font-bold text-red-600" : "text-gray-500"}>
                      {(selectedAdminSlip.potonganBpjsTk || 0) > 0 
                        ? `- Rp ${new Intl.NumberFormat('id-ID').format(selectedAdminSlip.potonganBpjsTk!)}` 
                        : "Rp 0"}
                    </span>
                  </div>

                  {/* BPJS Kesehatan */}
                  <div className="flex justify-between items-center py-1 border-b border-gray-100">
                    <span className="text-gray-700">BPJS Kesehatan ({selectedAdminSlip.bpjsKesRate ?? 1}%)</span>
                    <span className={(selectedAdminSlip.potonganBpjsKes || 0) > 0 ? "font-bold text-red-600" : "text-gray-500"}>
                      {(selectedAdminSlip.potonganBpjsKes || 0) > 0 
                        ? `- Rp ${new Intl.NumberFormat('id-ID').format(selectedAdminSlip.potonganBpjsKes!)}` 
                        : "Rp 0"}
                    </span>
                  </div>

                  {/* Total Potongan */}
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
            <div className="grid grid-cols-2 gap-4 sm:gap-12 mt-12 text-center text-xs">
              <div>
                <p className="text-gray-500 mb-1 invisible select-none text-xs">&nbsp;</p>
                <p className="text-gray-600 mb-20 font-medium">Penerima (Karyawan),</p>
                <p className="font-bold text-gray-900 border-b border-gray-400 pb-1 inline-block min-w-[120px] sm:min-w-[200px] uppercase">
                  {selectedAdminSlip.nama}
                </p>
                <p className="text-gray-700 font-mono text-[11px] mt-1 font-semibold">
                  {getAdminSlipPenerima(selectedAdminSlip).nik ? `NIK: ${getAdminSlipPenerima(selectedAdminSlip).nik}` : "NIK: -"}
                </p>
                <p className="text-gray-400 text-[10px]">
                  {getAdminSlipPenerima(selectedAdminSlip).jabatan}
                </p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Jakarta, {selectedAdminSlip.tanggal}</p>
                <p className="text-gray-600 mb-20 font-medium">Disahkan oleh (HRD & Finance),</p>
                <p className="font-bold text-gray-900 border-b border-gray-400 pb-1 inline-block min-w-[120px] sm:min-w-[200px] uppercase">
                  {selectedAdminSlip.hrdNama || currentAdminName || "PT. PILAR SENTRA SOLUSI"}
                </p>
                <p className="text-gray-700 font-mono text-[11px] mt-1 font-semibold">
                  {(selectedAdminSlip.hrdNik || currentAdminNik) ? `NIK: ${selectedAdminSlip.hrdNik || currentAdminNik}` : "HRD & Finance Manager"}
                </p>
                <p className="text-gray-400 text-[10px]">HRD & Finance</p>
              </div>
            </div>

            {/* FOOTER BAR DOKUMEN */}
            <div 
              className="mt-14 px-4 py-2.5 bg-[#114289] text-white flex flex-wrap sm:flex-nowrap items-center justify-between text-[10px] md:text-[11px] gap-3"
              style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            >
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-location-dot text-xs shrink-0"></i>
                <span>Jalan Hamadun gailea, Fagudu, Kepulauan Sula, Maluku Utara</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-envelope text-xs shrink-0"></i>
                <span>pilarsentrasolusi@gmail.com</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-phone text-xs shrink-0"></i>
                <span>0822-1037-1774</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH POSISI / JABATAN BARU */}
      {showAddPositionModal && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-pilar-darker/10 text-pilar-darker flex items-center justify-center font-bold">
                  <i className="fa-solid fa-briefcase"></i>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Tambah Jabatan Baru</h3>
                  <p className="text-xs text-gray-400">Tambahkan kategori posisi ke dalam master data</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowAddPositionModal(false);
                  setNewPositionName("");
                  setPositionModalError("");
                }}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleAddNewPosition} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Nama Posisi / Jabatan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newPositionName}
                  onChange={(e) => {
                    setNewPositionName(e.target.value);
                    if (positionModalError) setPositionModalError("");
                  }}
                  placeholder="Contoh: Staff HRD, Legal Officer..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker text-sm font-medium shadow-xs bg-gray-50/50 focus:bg-white transition-all"
                />
                {positionModalError && (
                  <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1 font-medium">
                    <i className="fa-solid fa-circle-exclamation shrink-0"></i>
                    <span>{positionModalError}</span>
                  </p>
                )}
              </div>

              <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-800">
                <i className="fa-solid fa-lightbulb text-amber-500 mt-0.5 shrink-0"></i>
                <span>Jabatan baru akan otomatis tersimpan di database dan langsung terpilih untuk karyawan ini.</span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSavingPosition}
                  onClick={() => {
                    setShowAddPositionModal(false);
                    setNewPositionName("");
                    setPositionModalError("");
                  }}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingPosition || !newPositionName.trim()}
                  className="px-5 py-2.5 rounded-xl bg-pilar-darker hover:bg-pilar-darker/90 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  {isSavingPosition ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-plus"></i>
                      <span>Simpan Jabatan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH ADMIN (Khusus Super Admin) */}
      {isAddAdminModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center relative overflow-hidden">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-pilar-darker text-pilar-gold flex items-center justify-center text-base shadow-xs">
                  <i className="fa-solid fa-user-plus"></i>
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-lg">Tambah Admin Baru</h3>
                  <p className="text-xs text-gray-500">Buat akun pengelola dengan hak akses terproteksi.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddAdminModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateAdmin} className="p-8 space-y-4" autoComplete="off">
              {adminActionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                  <i className="fa-solid fa-circle-exclamation shrink-0"></i>
                  <span>{adminActionError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Nama Asli & Gelar <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={adminFormNama}
                  onChange={(e) => setAdminFormNama(e.target.value)}
                  placeholder="Contoh: Budi Santoso, S.Psi"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker text-sm bg-gray-50/50 focus:bg-white transition-all"
                />
                <p className="text-[10px] text-gray-400 mt-1">Nama ini dicetak di Formulir Cuti/Izin, Slip Gaji, dan dokumen resmi.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  NIK (Nomor Induk Karyawan / HRD) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={adminFormNik}
                  onChange={(e) => setAdminFormNik(e.target.value)}
                  placeholder="Contoh: HRD-001 atau 3201012345670001"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker text-sm bg-gray-50/50 focus:bg-white transition-all font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">Wajib diisi sebagai nomor identitas pengesahan dokumen.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Email Akses Resmi</label>
                <input
                  type="email"
                  required
                  autoComplete="new-password"
                  name="new_admin_email"
                  value={adminFormEmail}
                  onChange={(e) => setAdminFormEmail(e.target.value)}
                  placeholder="admin.hrd@pt-pilar.co.id"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker text-sm bg-gray-50/50 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Kata Sandi (Password Awal)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  name="new_admin_password"
                  value={adminFormPassword}
                  onChange={(e) => setAdminFormPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker text-sm bg-gray-50/50 focus:bg-white transition-all"
                />
                <p className="text-[11px] text-gray-400 mt-1">Admin dapat mengganti password ini sewaktu-waktu.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Tingkat Hak Akses (Role)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setAdminFormRole("admin")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      adminFormRole === "admin"
                        ? "border-pilar-darker bg-gray-50 shadow-xs ring-1 ring-pilar-darker"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs text-gray-900 flex items-center gap-1.5">
                        <i className="fa-solid fa-user-tie text-pilar-darker"></i> Admin HRD
                      </span>
                      {adminFormRole === "admin" && <i className="fa-solid fa-circle-check text-pilar-darker text-xs"></i>}
                    </div>
                    <p className="text-[11px] text-gray-500">Kelola karyawan, absensi, cuti & slip gaji operasional.</p>
                  </div>

                  <div
                    onClick={() => setAdminFormRole("superadmin")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      adminFormRole === "superadmin"
                        ? "border-pilar-gold bg-pilar-gold/10 shadow-xs ring-1 ring-pilar-gold"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs text-gray-900 flex items-center gap-1.5">
                        <i className="fa-solid fa-crown text-pilar-gold"></i> Super Admin
                      </span>
                      {adminFormRole === "superadmin" && <i className="fa-solid fa-circle-check text-pilar-gold text-xs"></i>}
                    </div>
                    <p className="text-[11px] text-gray-500">Akses master penuh: kelola admin, audit trail & sistem.</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  disabled={adminActionLoading}
                  onClick={() => setIsAddAdminModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={adminActionLoading}
                  className="px-6 py-2.5 rounded-xl bg-pilar-darker hover:bg-black text-pilar-gold text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {adminActionLoading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                      <span>Membuat Akun...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check text-xs"></i>
                      <span>Simpan & Buat Akun</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT ADMIN (Khusus Super Admin) */}
      {isEditAdminModalOpen && selectedAdminForEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-pilar-darker text-pilar-gold flex items-center justify-center text-base shadow-xs">
                  <i className="fa-solid fa-pen-to-square"></i>
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-lg">Edit Akun Administrator</h3>
                  <p className="text-xs text-gray-500 font-mono">{selectedAdminForEdit.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditAdminModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdateAdmin} className="p-8 space-y-4" autoComplete="off">
              {adminActionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                  <i className="fa-solid fa-circle-exclamation shrink-0"></i>
                  <span>{adminActionError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Nama Asli & Gelar <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={adminFormNama}
                  onChange={(e) => setAdminFormNama(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker text-sm bg-gray-50/50 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  NIK (Nomor Induk Karyawan / HRD) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={adminFormNik}
                  onChange={(e) => setAdminFormNik(e.target.value)}
                  placeholder="Contoh: HRD-001"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker text-sm bg-gray-50/50 focus:bg-white transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Reset Kata Sandi (Opsional)</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  name="edit_admin_password"
                  value={adminFormPassword}
                  onChange={(e) => setAdminFormPassword(e.target.value)}
                  placeholder="Kosongkan jika tidak ingin mengubah password"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker text-sm bg-gray-50/50 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Tingkat Hak Akses (Role)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setAdminFormRole("admin")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      adminFormRole === "admin"
                        ? "border-pilar-darker bg-gray-50 shadow-xs ring-1 ring-pilar-darker"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs text-gray-900 flex items-center gap-1.5">
                        <i className="fa-solid fa-user-tie text-pilar-darker"></i> Admin HRD
                      </span>
                      {adminFormRole === "admin" && <i className="fa-solid fa-circle-check text-pilar-darker text-xs"></i>}
                    </div>
                    <p className="text-[11px] text-gray-500">Operasional HR, absensi & cuti.</p>
                  </div>

                  <div
                    onClick={() => setAdminFormRole("superadmin")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      adminFormRole === "superadmin"
                        ? "border-pilar-gold bg-pilar-gold/10 shadow-xs ring-1 ring-pilar-gold"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs text-gray-900 flex items-center gap-1.5">
                        <i className="fa-solid fa-crown text-pilar-gold"></i> Super Admin
                      </span>
                      {adminFormRole === "superadmin" && <i className="fa-solid fa-circle-check text-pilar-gold text-xs"></i>}
                    </div>
                    <p className="text-[11px] text-gray-500">Akses master penuh.</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  disabled={adminActionLoading}
                  onClick={() => setIsEditAdminModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={adminActionLoading}
                  className="px-6 py-2.5 rounded-xl bg-pilar-darker hover:bg-black text-pilar-gold text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {adminActionLoading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check text-xs"></i>
                      <span>Simpan Perubahan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HAPUS ADMIN (Khusus Super Admin - Standardized) */}
      {isDeleteAdminModalOpen && selectedAdminForDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200 p-8 text-center relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

            <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner border border-red-100 relative z-10">
              <i className="fa-solid fa-trash-can"></i>
            </div>
            <h3 className="font-extrabold text-gray-900 text-xl tracking-tight mb-2 relative z-10">Cabut Hak Akses Admin?</h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-6 relative z-10">
              Apakah Anda yakin ingin mencabut hak akses dan menghapus akun <strong className="text-gray-900 font-bold">{selectedAdminForDelete.nama}</strong> ({selectedAdminForDelete.email})?
            </p>

            {adminActionError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2 text-left relative z-10">
                <i className="fa-solid fa-circle-exclamation shrink-0"></i>
                <span>{adminActionError}</span>
              </div>
            )}

            <div className="flex items-center justify-center gap-3 relative z-10">
              <button
                type="button"
                disabled={adminActionLoading}
                onClick={() => setIsDeleteAdminModalOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-50 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={adminActionLoading}
                onClick={handleDeleteAdmin}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md hover:shadow-lg focus:ring-4 focus:ring-red-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {adminActionLoading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin text-sm"></i>
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-trash-can text-sm"></i>
                    <span>Ya, Hapus Akun</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TERBITKAN SURAT PERINGATAN (SP) BARU */}
      {isAddSpModalOpen && (
        <div className="fixed inset-0 z-[200] bg-gray-900/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative my-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pilar-darker text-pilar-gold flex items-center justify-center text-lg">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900">Terbitkan Surat Peringatan</h3>
                  <p className="text-xs text-gray-400">Peringatan kedisiplinan dan sanksi resmi karyawan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSpModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <form onSubmit={handleSaveSp} className="mt-5 space-y-4 text-xs">
              {/* Pilih Karyawan */}
              <div>
                <label className="block font-bold text-gray-700 mb-1.5">
                  Karyawan Yang Dikenakan Sanksi <span className="text-red-500">*</span>
                </label>
                <select
                  value={spFormKaryawanId}
                  onChange={(e) => setSpFormKaryawanId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:border-pilar-darker focus:bg-white"
                  required
                >
                  <option value="">-- Pilih Karyawan --</option>
                  {karyawanList.map(k => (
                    <option key={k.id} value={k.id}>
                      {k.nama} ({k.posisi || "Staf"} • NIK: {k.noInduk || "-"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tingkat SP & Nomor Surat */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1.5">
                    Tingkat Sanksi / SP <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={spFormTingkat}
                    onChange={(e) => {
                      const val = e.target.value as "Surat Teguran" | "SP 1" | "SP 2" | "SP 3";
                      setSpFormTingkat(val);
                      setSpFormNomor(generateSpNumber(val));
                    }}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:border-pilar-darker focus:bg-white"
                  >
                    <option value="Surat Teguran">Surat Teguran (Awal)</option>
                    <option value="SP 1">Surat Peringatan 1 (SP 1)</option>
                    <option value="SP 2">Surat Peringatan 2 (SP 2)</option>
                    <option value="SP 3">Surat Peringatan 3 (SP 3 - Terakhir)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1.5">
                    Nomor Dokumen <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={spFormNomor}
                    onChange={(e) => setSpFormNomor(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-800 focus:outline-none focus:border-pilar-darker focus:bg-white"
                    placeholder="001/SP-1/HRD-PSS/IX/2026"
                    required
                  />
                </div>
              </div>

              {/* Tanggal & Masa Berlaku */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1.5">
                    Tanggal Diterbitkan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={spFormTanggal}
                    onChange={(e) => setSpFormTanggal(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:border-pilar-darker focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1.5">
                    Masa Berlaku Sanksi
                  </label>
                  <select
                    value={spFormMasaBulan}
                    onChange={(e) => setSpFormMasaBulan(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:border-pilar-darker focus:bg-white"
                  >
                    <option value={1}>1 Bulan</option>
                    <option value={3}>3 Bulan</option>
                    <option value={6}>6 Bulan (Standar UU Ketenagakerjaan)</option>
                    <option value={12}>12 Bulan (1 Tahun)</option>
                  </select>
                </div>
              </div>

              {/* Alasan Pelanggaran */}
              <div>
                <label className="block font-bold text-gray-700 mb-1.5">
                  Alasan / Butir Pelanggaran <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={spFormAlasan}
                  onChange={(e) => setSpFormAlasan(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:border-pilar-darker focus:bg-white"
                  placeholder="Contoh: Ketidakhadiran tanpa izin selama 3 hari berturut-turut"
                  required
                />
              </div>

              {/* Detail Kronologis */}
              <div>
                <label className="block font-bold text-gray-700 mb-1.5">
                  Kronologi & Keterangan Tambahan
                </label>
                <textarea
                  value={spFormDetail}
                  onChange={(e) => setSpFormDetail(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:border-pilar-darker focus:bg-white"
                  placeholder="Jelaskan rincian tanggal kejadian, dampak terhadap operasional perusahaan..."
                />
              </div>

              {/* Tindakan Perbaikan */}
              <div>
                <label className="block font-bold text-gray-700 mb-1.5">
                  Tindakan Perbaikan & Konsekuensi Lanjutan
                </label>
                <textarea
                  value={spFormTindakan}
                  onChange={(e) => setSpFormTindakan(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:border-pilar-darker focus:bg-white"
                  placeholder="Contoh: Karyawan wajib memperbaiki kehadiran. Pengulangan pelanggaran akan berakibat sanksi tingkat berikutnya."
                />
              </div>

              {/* Info Pemberitahuan & Penerbit */}
              <div className="p-3.5 bg-pilar-darker/5 border border-pilar-gold/30 rounded-xl space-y-2 text-xs">
                <div className="flex items-start gap-2.5 text-gray-700">
                  <i className="fa-solid fa-circle-info text-pilar-gold mt-0.5 shrink-0 text-sm"></i>
                  <p className="text-[11px] leading-relaxed">
                    Sistem ini mengirimkan <span className="font-bold text-pilar-darker">pemberitahuan digital resmi</span> ke akun aplikasi karyawan. Dokumen fisik SP dicetak secara manual oleh HRD/Manajemen untuk diserahkan langsung.
                  </p>
                </div>
                <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-[11px] text-gray-700">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500">Penerbit:</span>
                    <strong className="text-pilar-darker">{currentAdminName || "PT. PILAR SENTRA SOLUSI"}</strong>
                  </div>
                  <span className="font-mono text-[10px] text-gray-500">{currentAdminNik ? `NIK: ${currentAdminNik}` : "HRD & Personalia"}</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  disabled={isSavingSp}
                  onClick={() => setIsAddSpModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingSp}
                  className="px-6 py-2.5 rounded-xl bg-pilar-darker text-pilar-gold font-bold shadow-md hover:bg-black transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingSp ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                      <span>Mengirim...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane text-xs"></i>
                      <span>Kirim Pemberitahuan SP</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DETAIL PEMBERITAHUAN SP */}
      {selectedSpDetail && (
        <div className="fixed inset-0 z-[200] bg-gray-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in fade-in zoom-in-95 border border-gray-100">
            {/* Modal Header (Navy, Gold, Gray) */}
            <div className="px-6 py-5 bg-pilar-darker text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-pilar-gold text-base">
                  <i className="fa-solid fa-file-shield"></i>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base text-white">Detail Pemberitahuan SP</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-pilar-gold text-pilar-darker">
                      {selectedSpDetail.tingkatSp}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-gray-300 mt-0.5">{selectedSpDetail.nomorSurat}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSpDetail(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Tutup Modal"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto p-6 space-y-5 flex-1 bg-white text-gray-800">
              {/* Informational Banner: Manual Print Notice */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-pilar-darker text-pilar-gold flex items-center justify-center shrink-0 text-xs">
                  <i className="fa-solid fa-circle-info"></i>
                </div>
                <div className="text-xs text-gray-600 leading-relaxed">
                  <p className="font-bold text-pilar-darker mb-0.5">Pemberitahuan Digital Karyawan</p>
                  <p>
                    Data ini berfungsi sebagai pemberitahuan resmi yang tampil di akun aplikasi karyawan. Dokumen fisik Surat Peringatan dicetak secara manual oleh HRD/Manajemen di luar aplikasi dan diserahkan langsung.
                  </p>
                </div>
              </div>

              {/* Data Karyawan */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-pilar-darker block">
                  Identitas Karyawan
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-gray-200">
                    <span className="text-[10px] text-gray-500 font-medium block">Nama Karyawan</span>
                    <span className="font-black text-gray-900 text-sm">{selectedSpDetail.karyawanNama}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-gray-200">
                    <span className="text-[10px] text-gray-500 font-medium block">No. Induk (NIK)</span>
                    <span className="font-mono font-bold text-gray-900 text-sm">{selectedSpDetail.karyawanNik || "-"}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-gray-200">
                    <span className="text-[10px] text-gray-500 font-medium block">Jabatan / Posisi</span>
                    <span className="font-bold text-gray-900">{selectedSpDetail.karyawanPosisi || "-"}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-gray-200">
                    <span className="text-[10px] text-gray-500 font-medium block">Status Sanksi</span>
                    <span className={`inline-block px-2.5 py-0.5 mt-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                      selectedSpDetail.status === "Aktif" 
                        ? "bg-pilar-gold/20 text-pilar-darker border-pilar-gold/40" 
                        : "bg-gray-100 text-gray-600 border-gray-200"
                    }`}>
                      {selectedSpDetail.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rincian Pelanggaran */}
              <div className="space-y-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-pilar-darker block">
                  Rincian Pelanggaran Disiplin
                </span>
                <div className="space-y-2.5">
                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                    <span className="text-[10px] text-gray-500 font-bold block mb-1 uppercase tracking-wide">Butir Pelanggaran:</span>
                    <p className="text-xs font-bold text-gray-900 leading-relaxed">
                      {selectedSpDetail.alasanPelanggaran}
                    </p>
                  </div>
                  {selectedSpDetail.detailPelanggaran && (
                    <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                      <span className="text-[10px] text-gray-500 font-bold block mb-1 uppercase tracking-wide">Kronologi & Uraian Fakta:</span>
                      <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">
                        {selectedSpDetail.detailPelanggaran}
                      </p>
                    </div>
                  )}
                  {selectedSpDetail.tindakanPerbaikan && (
                    <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                      <span className="text-[10px] text-gray-500 font-bold block mb-1 uppercase tracking-wide">Tindakan Perbaikan / Konsekuensi:</span>
                      <p className="text-xs text-gray-700 leading-relaxed">
                        {selectedSpDetail.tindakanPerbaikan}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Masa Berlaku & Konfirmasi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-1.5">
                  <span className="text-[10px] text-gray-500 font-bold block uppercase tracking-wide">Periode Masa Berlaku</span>
                  <div className="text-gray-700 text-xs space-y-0.5">
                    <div>Mulai: <span className="font-bold text-gray-900">{new Date(selectedSpDetail.berlakuMulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                    <div>Sampai: <span className="font-bold text-pilar-darker">{new Date(selectedSpDetail.berlakuSampai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                  </div>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-1.5">
                  <span className="text-[10px] text-gray-500 font-bold block uppercase tracking-wide">Konfirmasi Karyawan</span>
                  {selectedSpDetail.isAcknowledged ? (
                    <div className="flex items-center gap-2 text-pilar-darker font-bold">
                      <i className="fa-solid fa-circle-check text-pilar-gold text-sm"></i>
                      <span>Telah Dibaca ({selectedSpDetail.acknowledgedAt ? new Date(selectedSpDetail.acknowledgedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : "-"})</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-500 font-medium">
                      <i className="fa-solid fa-clock text-gray-400 text-sm"></i>
                      <span>Menunggu konfirmasi karyawan</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Penerbit */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between text-[11px] text-gray-600">
                <div>
                  <span className="text-gray-400 block text-[10px]">Diterbitkan Oleh:</span>
                  <span className="font-bold text-gray-800">{selectedSpDetail.hrdNama || "PT. PILAR SENTRA SOLUSI"}</span>
                  <span className="text-gray-500 ml-1">({selectedSpDetail.hrdJabatan || "HRD"})</span>
                </div>
                <span className="font-mono text-gray-400 text-[10px]">
                  Terbit: {new Date(selectedSpDetail.tanggalTerbit).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <div>
                {selectedSpDetail.status === "Aktif" && (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleUpdateSpStatus(selectedSpDetail.id!, "Selesai");
                      setSelectedSpDetail(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-gray-200 hover:bg-pilar-darker text-gray-700 hover:text-pilar-gold font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-check text-xs"></i>
                    <span>Tandai Sanksi Selesai</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedSpDetail(null)}
                className="px-5 py-2 rounded-xl bg-pilar-darker text-pilar-gold hover:bg-black font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: KONFIRMASI HAPUS SP (Standardized) */}
      {isDeleteSpModalOpen && spToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200 p-8 text-center relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

            <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner border border-red-100 relative z-10">
              <i className="fa-solid fa-trash-can"></i>
            </div>
            <h3 className="font-extrabold text-gray-900 text-xl tracking-tight mb-2 relative z-10">Hapus Surat Peringatan?</h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-6 relative z-10">
              Apakah Anda yakin ingin menghapus arsip Surat Peringatan <strong className="text-gray-900 font-bold">{spToDelete.nomorSurat}</strong> ({spToDelete.karyawanNama})?
            </p>

            <div className="flex items-center justify-center gap-3 relative z-10">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteSpModalOpen(false);
                  setSpToDelete(null);
                }}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-50 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteSp}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md hover:shadow-lg focus:ring-4 focus:ring-red-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-trash-can text-sm"></i>
                <span>Ya, Hapus SP</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

