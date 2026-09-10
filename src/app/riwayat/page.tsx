"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NotificationBell from "@/components/NotificationBell";
import Toast from "@/components/Toast";
import { subscribeToAllAttendance, getEmployee } from "@/lib/db";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

// Dummy Type & Data
type RiwayatAbsen = {
  id: number;
  tanggal: string; // Format: YYYY-MM-DD
  jamMasuk: string;
  jamKeluar: string;
  status: "Hadir" | "Sakit" | "Izin" | "Cuti" | "Absen";
  keterangan: string;
};

const dummyRiwayat: RiwayatAbsen[] = [
  { id: 1, tanggal: "2026-09-06", jamMasuk: "07:45", jamKeluar: "17:05", status: "Hadir", keterangan: "-" },
  { id: 2, tanggal: "2026-09-05", jamMasuk: "07:50", jamKeluar: "17:00", status: "Hadir", keterangan: "-" },
  { id: 3, tanggal: "2026-09-04", jamMasuk: "-", jamKeluar: "-", status: "Izin", keterangan: "Keperluan Keluarga" },
  { id: 4, tanggal: "2026-08-20", jamMasuk: "08:10", jamKeluar: "17:00", status: "Hadir", keterangan: "Terlambat (Macet)" },
  { id: 5, tanggal: "2026-08-15", jamMasuk: "-", jamKeluar: "-", status: "Sakit", keterangan: "Demam" },
];

export default function RiwayatPage() {
  // Absen State
  const [selectedMonth, setSelectedMonth] = useState("09"); // Default: September
  const [selectedYear, setSelectedYear] = useState("2026");

  const [toastMessage, setToastMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [riwayatAbsen, setRiwayatAbsen] = useState<RiwayatAbsen[]>([]);

  useEffect(() => {
    let unsubscribeAttendance: any;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const emp = await getEmployee(user.uid);
        if (emp) {
          setCurrentUser(emp);
          unsubscribeAttendance = subscribeToAllAttendance((data) => {
            // Re-format tanggal to YYYY-MM-DD reliably
            const formattedAttendance = data.filter(d => d.karyawanId === emp.id).map(d => {
             let isoDate = d.tanggal || ""; // Fallback
             try {
                // if d.tanggal is DD/MM/YYYY
                if (isoDate.includes("/")) {
                  const parts = isoDate.split("/");
                  if (parts.length === 3) {
                     isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                  }
                } else if (isoDate.includes("-")) {
                  const parts = isoDate.split("-");
                  if (parts[0].length === 2) {
                    // DD-MM-YYYY
                    isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                  }
                }
             } catch(e) {}
             
             // Determine if Terlambat (based on status or keterangan or jamMasuk)
             let keterangan = d.keterangan || "-";
             let status = d.status || "Hadir";

             // Check if late based on time if status is Hadir
             if (status === "Hadir" && d.jamMasuk && d.jamMasuk > "08:15" && d.jamMasuk !== "-") {
                keterangan = "Terlambat";
             }
             
             return {
               id: d.id as any,
               tanggal: isoDate,
               jamMasuk: d.jamMasuk || "-",
               jamKeluar: d.jamKeluar || "-",
               status: status,
               keterangan: keterangan
             };
          });
          
          setRiwayatAbsen(formattedAttendance);
        });
        }
      } else {
        setCurrentUser(null);
        setRiwayatAbsen([]);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeAttendance) unsubscribeAttendance();
    };
  }, []);

  const filteredRiwayat = riwayatAbsen.filter((item) => {
    const [year, month] = item.tanggal.split("-");
    return year === selectedYear && month === selectedMonth;
  });
  
  // Urutkan dari tanggal terbaru
  filteredRiwayat.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());


  const getStatusStyle = (item: any) => {
    if (item.status === "Hadir") {
      if (item.keterangan?.toLowerCase().includes("terlambat") || (item.jamMasuk && item.jamMasuk > "08:15" && item.jamMasuk !== "-")) {
        return "bg-[#fef08a]/10 text-[#fef08a] border border-[#fef08a]/20"; // Terlambat
      }
      return "bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20"; // Tepat Waktu
    }
    if (["Izin", "Sakit", "Cuti", "Disetujui", "Menunggu", "Revisi"].includes(item.status)) {
      return "bg-[#cbd5e1]/10 text-[#cbd5e1] border border-[#cbd5e1]/20"; // Izin/Sakit/Cuti
    }
    return "bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20"; // Absen
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Hadir": return "fa-check";
      case "Sakit": return "fa-briefcase-medical";
      case "Izin": return "fa-envelope-open-text";
      case "Cuti": return "fa-plane-departure";
      case "Menunggu": return "fa-clock";
      case "Disetujui": return "fa-check-double";
      case "Revisi": return "fa-pen-to-square";
      default: return "fa-xmark";
    }
  };

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'short' };
    return new Date(dateString).toLocaleDateString('id-ID', options);
  };

  const stats = { TepatWaktu: 0, Terlambat: 0, IzinSakitCuti: 0, Absen: 0 };
  filteredRiwayat.forEach(item => {
    if (item.status === "Hadir") {
      if (item.keterangan?.toLowerCase().includes("terlambat") || (item.jamMasuk && item.jamMasuk > "08:15" && item.jamMasuk !== "-")) {
        stats.Terlambat += 1;
      } else {
        stats.TepatWaktu += 1;
      }
    } else if (["Izin", "Sakit", "Cuti", "Disetujui", "Menunggu", "Revisi"].includes(item.status)) {
      stats.IzinSakitCuti += 1;
    } else if (["Absen", "Ditolak"].includes(item.status)) {
      stats.Absen += 1;
    }
  });

  const chartData = [
    { name: 'Tepat Waktu', value: stats.TepatWaktu, color: '#d4af37' }, // Gold Primary
    { name: 'Terlambat', value: stats.Terlambat, color: '#fef08a' }, // Light Gold
    { name: 'Izin/Sakit/Cuti', value: stats.IzinSakitCuti, color: '#cbd5e1' }, // Silver
    { name: 'Absen', value: stats.Absen, color: '#ef4444' }, // Red
  ].filter(d => d.value > 0);

  return (
    <div className="mobile-container flex flex-col text-pilar-textPrimary mx-auto shadow-2xl">
      {/* Header */}
      <header className="pt-10 pb-6 px-6 bg-pilar-darker rounded-b-3xl shadow-md z-10 relative">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold font-heading text-pilar-textPrimary">
              Riwayat
            </h1>
            <h2 className="text-xs text-pilar-textSecondary tracking-wider">
              Rekam Jejak & Pengajuan
            </h2>
          </div>
          <div className="flex items-center space-x-3">
            <NotificationBell />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto scrollable-content px-6 py-6 pb-24 relative animate-slide-up">
        
        {toastMessage && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-11/12 max-w-sm z-50 pointer-events-auto">
            <Toast 
              type={toastMessage.toLowerCase().includes("gagal") || toastMessage.toLowerCase().includes("kesalahan") ? "error" : "success"}
              description={toastMessage} 
              onClose={() => setToastMessage("")} 
            />
          </div>
        )}

        {/* List Riwayat Absen */}
        <div className="animate-fade-in">
            {/* Filter Section */}
            <div className="flex space-x-3 mb-6">
              <div className="flex-1">
                <label className="block text-[10px] text-pilar-textSecondary mb-1 uppercase tracking-wider">Bulan</label>
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full bg-pilar-darker border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pilar-gold appearance-none text-white"
                >
                  <option value="01">Januari</option>
                  <option value="02">Februari</option>
                  <option value="03">Maret</option>
                  <option value="04">April</option>
                  <option value="05">Mei</option>
                  <option value="06">Juni</option>
                  <option value="07">Juli</option>
                  <option value="08">Agustus</option>
                  <option value="09">September</option>
                  <option value="10">Oktober</option>
                  <option value="11">November</option>
                  <option value="12">Desember</option>
                </select>
              </div>
              <div className="w-1/3">
                <label className="block text-[10px] text-pilar-textSecondary mb-1 uppercase tracking-wider">Tahun</label>
                <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full bg-pilar-darker border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pilar-gold appearance-none text-white"
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                </select>
              </div>
            </div>

            {/* Graphic Chart Kinerja */}
            {chartData.length > 0 && (
              <div className="bg-white/5 border border-white/10 p-5 rounded-2xl mb-6">
                <h3 className="text-[10px] font-bold text-pilar-textSecondary uppercase tracking-widest mb-4">
                  Kinerja Bulan Ini
                </h3>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#021226', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff', fontSize: '12px' }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36} 
                        iconType="circle"
                        wrapperStyle={{ fontSize: '10px', color: '#a1a1aa' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* List Riwayat */}
            <div className="mt-4">
              {filteredRiwayat.length > 0 ? (
                filteredRiwayat.map((item, index) => (
                  <div key={item.id} className={`p-4 flex items-center hover:bg-white/5 transition ${index !== filteredRiwayat.length - 1 ? 'border-b border-white/10' : ''}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 ${getStatusStyle(item)}`}>
                      <i className={`fa-solid ${getStatusIcon(item.status)} text-sm`}></i>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{formatDate(item.tanggal)}</p>
                      <div className="flex text-xs text-pilar-textSecondary mt-1 space-x-3">
                        <span>
                          <i className="fa-solid fa-arrow-right-to-bracket text-pilar-gold mr-1"></i>
                          {item.jamMasuk}
                        </span>
                        <span>
                          <i className="fa-solid fa-arrow-right-from-bracket mr-1"></i>
                          {item.jamKeluar}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-center">
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${getStatusStyle(item)}`}>
                        {item.status}
                      </span>
                      {item.keterangan !== "-" && (
                        <span className="text-[9px] text-gray-400 mt-1 max-w-[80px] truncate text-right">
                          {item.keterangan}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <i className="fa-solid fa-folder-open text-3xl text-pilar-textSecondary mb-3"></i>
                  <p className="text-sm text-pilar-textSecondary">Belum ada data absensi pada periode ini.</p>
                </div>
              )}
            </div>
          </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 w-full bg-pilar-darker border-t border-white/10 px-6 py-4 flex justify-between items-center z-20">
        <Link href="/" className="flex flex-col items-center text-pilar-textSecondary hover:text-pilar-textPrimary transition-colors">
          <i className="fa-solid fa-house text-xl mb-1"></i>
          <span className="text-[10px] font-medium">Beranda</span>
        </Link>
        <Link href="/riwayat" className="flex flex-col items-center text-pilar-gold">
          <i className="fa-solid fa-clock-rotate-left text-xl mb-1"></i>
          <span className="text-[10px] font-medium">Riwayat</span>
        </Link>
        <Link href="/pengajuan" className="flex flex-col items-center text-pilar-textSecondary hover:text-pilar-textPrimary transition-colors">
          <i className="fa-solid fa-file-invoice text-xl mb-1"></i>
          <span className="text-[10px] font-medium">Pengajuan</span>
        </Link>
        <Link href="/gaji" className="flex flex-col items-center text-pilar-textSecondary hover:text-pilar-textPrimary transition-colors">
          <i className="fa-solid fa-sack-dollar text-xl mb-1"></i>
          <span className="text-[10px] font-medium">Gaji</span>
        </Link>
        <Link href="/pengaturan" className="flex flex-col items-center text-pilar-textSecondary hover:text-pilar-textPrimary transition-colors">
          <i className="fa-solid fa-cog text-xl mb-1"></i>
          <span className="text-[10px] font-medium">Pengaturan</span>
        </Link>
      </nav>
    </div>
  );
}
