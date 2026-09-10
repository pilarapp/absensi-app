"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NotificationBell from "@/components/NotificationBell";
import Toast from "@/components/Toast";
import { submitRequest, updateRequest, fetchRequestById, subscribeToRequests, addNotification, getEmployee, fetchEmployees } from "@/lib/db";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

type PengajuanType = "Cuti Tahunan" | "Cuti Sakit" | "Cuti Haid" | "Cuti Melahirkan" | "Cuti Khusus" | "Izin Pribadi" | "Cuti Lembur" | "Cuti Tanpa Bayar";

export default function PengajuanPage() {
  const [type, setType] = useState<PengajuanType>("Cuti Tahunan");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  
  // State untuk Pelimpahan Tugas
  const [delegationName, setDelegationName] = useState("");
  const [delegationId, setDelegationId] = useState("");
  const [delegationRole, setDelegationRole] = useState("");
  const [delegationNik, setDelegationNik] = useState("");

  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pengajuanList, setPengajuanList] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);

  useEffect(() => {
    fetchEmployees().then(data => {
      setAllEmployees(data);
    });
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const employeeData = await getEmployee(user.uid);
        if (employeeData) {
          setCurrentUser({
            ...employeeData,
            // Prioritaskan nama asli dari akun Google pengguna
            nama: user.displayName || employeeData.nama,
            // Gunakan nomor induk asli jika ada, kalau tidak gunakan awalan UID agar lebih rapi
            id: employeeData.karyawanId || employeeData.noInduk || (user.uid ? `PLR-${user.uid.substring(0,6).toUpperCase()}` : "-")
          });
        } else {
          setCurrentUser({
            id: user.uid ? `PLR-${user.uid.substring(0,6).toUpperCase()}` : "-",
            nama: user.displayName || "Karyawan",
            divisi: "Staff",
            posisi: "Karyawan Umum"
          });
        }
      }
    });

    const unsubscribe = subscribeToRequests((data) => {
      // Menampilkan pengajuan yang relevan (fallback ke ID dummy jika user belum termuat)
      const userId = currentUser ? currentUser.id : "PLR-2023-089";
      const myRequests = data.filter((p: any) => p.karyawanId === userId);
      myRequests.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPengajuanList(myRequests);
    });
    
    return () => {
      unsubscribeAuth();
      unsubscribe();
    };
  }, [currentUser?.id]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Disetujui": return "bg-green-500/20 text-green-400";
      case "Menunggu": return "bg-purple-500/20 text-purple-400";
      case "Revisi": return "bg-orange-500/20 text-orange-400";
      default: return "bg-red-500/20 text-red-400";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Menunggu": return "fa-clock";
      case "Disetujui": return "fa-check-double";
      case "Revisi": return "fa-pen-to-square";
      default: return "fa-xmark";
    }
  };
  
  
  const [duration, setDuration] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    const editIdStr = localStorage.getItem("edit_pengajuan_id");
    if (editIdStr) {
      fetchRequestById(editIdStr).then((item: any) => {
        if (item) {
          setEditId(item.id);
          setType(item.type);
          setStartDate(item.startDate);
          setEndDate(item.endDate);
          setReason(item.reason);
          setAdditionalNotes(item.additionalNotes);
          setDelegationName(item.delegationName);
          setDelegationId(item.delegationId);
          setDelegationRole(item.delegationRole);
        }
      });
    }
  }, []);

  // Menghitung lama cuti secara otomatis
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end >= start) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 untuk menghitung hari awal
        setDuration(diffDays);
      } else {
        setDuration(0);
      }
    } else {
      setDuration(0);
    }
  }, [startDate, endDate]);

  const needsAttachment = ["Cuti Sakit", "Cuti Melahirkan", "Cuti Khusus"].includes(type);

  // Bersihkan lampiran jika tipe cuti berubah menjadi yang tidak membutuhkan lampiran
  useEffect(() => {
    if (!needsAttachment) {
      setAttachments([]);
    }
  }, [needsAttachment]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments(prev => {
        const combined = [...prev, ...newFiles];
        if (combined.length > 5) {
          setToastMessage("Maksimal hanya 5 file yang diperbolehkan.");
          setTimeout(() => setToastMessage(""), 3000);
          return combined.slice(0, 5);
        }
        return combined;
      });
    }
  };

  const removeFile = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const [minDateAllowed, setMinDateAllowed] = useState("");

  useEffect(() => {
    const today = new Date();
    today.setDate(today.getDate() + 30);
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setMinDateAllowed(`${year}-${month}-${day}`);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const selectedDate = new Date(startDate);
      const minimumDate = new Date();
      minimumDate.setDate(minimumDate.getDate() + 30);
      selectedDate.setHours(0, 0, 0, 0);
      minimumDate.setHours(0, 0, 0, 0);

      // Hanya validasi 30 hari jika bukan sedang revisi (buat pengajuan baru)
      if (!editId && selectedDate < minimumDate) {
        setToastMessage("Pengajuan cuti harus minimal 30 hari sebelumnya!");
        setTimeout(() => setToastMessage(""), 5000);
        setIsSubmitting(false);
        return;
      }
      let uploadedFilesData = [];
      if (attachments.length > 0) {
        setToastMessage("Mengunggah dokumen ke Google Drive...");
        const formData = new FormData();
        attachments.forEach(file => {
          formData.append("files", file);
        });
        
        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        
        const uploadResult = await uploadResponse.json();
        
        if (!uploadResponse.ok) {
          throw new Error(uploadResult.error || "Gagal mengunggah file");
        }
        
        uploadedFilesData = uploadResult.files;
      }
      
      if (editId) {
        // Update existing pengajuan in Firestore
        const updateData = {
          type,
          startDate,
          endDate,
          duration,
          reason,
          additionalNotes,
          delegationName,
          delegationId,
          delegationRole,
          ...(uploadedFilesData.length > 0 && { files: uploadedFilesData }),
          status: "Menunggu",
          isRevision: true
        };
        
        await updateRequest(editId.toString(), updateData);

        const namaKaryawan = currentUser ? currentUser.nama : "Karyawan";
        addNotification("admin", "Revisi Pengajuan", `Karyawan ${namaKaryawan} telah merevisi pengajuan ${type}.`, "info");

        setToastMessage("Perbaikan pengajuan berhasil dikirim.");
        localStorage.removeItem("edit_pengajuan_id");
        setEditId(null);
        
        setTimeout(() => setToastMessage(""), 3000);
      } else {
        const newPengajuan = {
          karyawanId: currentUser ? currentUser.id : "unknown",
          karyawanNama: currentUser ? currentUser.nama : "Karyawan",
          karyawanDivisi: currentUser ? (currentUser.divisi || "-") : "-",
          karyawanPosisi: currentUser ? (currentUser.posisi || "-") : "-",
          type,
          startDate,
          endDate,
          duration,
          reason,
          additionalNotes,
          delegationName,
          delegationId,
          delegationRole,
          files: uploadedFilesData,
          status: "Menunggu", // Menunggu, Disetujui, Revisi, Ditolak
          alasanPenolakan: "",
        };

        const res = await submitRequest(newPengajuan);

        if (res) {
          setToastMessage("Pengajuan berhasil dikirim dan menunggu persetujuan.");
          
          const namaKaryawan = currentUser ? currentUser.nama : "Karyawan";
          addNotification("admin", "Pengajuan Baru", `Ada pengajuan ${type} baru dari ${namaKaryawan}!`, "info");

          setTimeout(() => setToastMessage(""), 3000);
        } else {
          throw new Error("Gagal menyimpan ke database.");
        }
      }

      // Reset form
      setStartDate("");
      setEndDate("");
      setReason("");
      setAdditionalNotes("");
      setDelegationName("");
      setDelegationId("");
      setDelegationRole("");
      setAttachments([]);
      setIsFormOpen(false);
      
    } catch (error: any) {
      console.error("Submit error:", error);
      setToastMessage(error.message || "Terjadi kesalahan pada sistem.");
      setTimeout(() => setToastMessage(""), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mobile-container flex flex-col text-pilar-textPrimary mx-auto shadow-2xl">
      {/* Header */}
      <header className="pt-10 pb-6 px-6 bg-pilar-darker rounded-b-3xl shadow-md z-10 relative">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold font-heading text-pilar-textPrimary">
              {editId ? "Perbaiki Pengajuan" : "Pengajuan"}
            </h1>
            <h2 className="text-xs text-pilar-textSecondary tracking-wider">
              Formulir Izin & Cuti
            </h2>
          </div>
          <div className="flex items-center space-x-3">
            <NotificationBell />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto scrollable-content px-6 py-6 pb-24 animate-slide-up">
        
        {toastMessage && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-11/12 max-w-sm z-50 pointer-events-auto">
            <Toast 
              type={toastMessage.toLowerCase().includes("kesalahan") || toastMessage.toLowerCase().includes("maksimal") || toastMessage.toLowerCase().includes("minimal") ? "error" : toastMessage.toLowerCase().includes("mengunggah") ? "info" : "success"}
              description={toastMessage} 
              onClose={() => setToastMessage("")} 
            />
          </div>
        )}

        {isFormOpen && (
          <div className="animate-fade-in">
            <button 
              onClick={() => setIsFormOpen(false)}
              className="mb-4 flex items-center text-pilar-textSecondary hover:text-white transition text-sm font-medium"
            >
              <i className="fa-solid fa-arrow-left mr-2"></i> Kembali
            </button>
            <form onSubmit={handleSubmit} className="bg-white/5 p-5 rounded-2xl border border-white/10 mb-8">
          
          {/* Read-Only Data Pegawai */}
          <div className="mb-6 p-4 bg-pilar-darker rounded-xl border border-white/5">
            <h3 className="text-[10px] font-bold text-pilar-textSecondary uppercase tracking-widest mb-3 border-b border-white/10 pb-2">Data Pegawai</h3>
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <div className="text-gray-400">Nama</div>
              <div className="font-medium text-white text-right truncate" title={currentUser?.nama || ""}>{currentUser ? currentUser.nama : "Memuat..."}</div>
              <div className="text-gray-400">No. Induk</div>
              <div className="font-medium text-white text-right truncate" title={currentUser?.id || ""}>{currentUser ? currentUser.id : "-"}</div>
              <div className="text-gray-400">Jabatan</div>
              <div className="font-medium text-white text-right truncate" title={currentUser?.posisi || ""}>{currentUser ? currentUser.posisi : "-"}</div>
            </div>
          </div>

          {/* Information Banner based on Type */}
          {type === "Cuti Sakit" && (
            <div className="mb-4 bg-blue-500/20 border border-blue-500/30 p-3 rounded-xl flex items-start space-x-3">
              <i className="fa-solid fa-circle-info text-blue-400 mt-0.5"></i>
              <p className="text-xs text-blue-100">Sakit lebih dari 1 hari wajib melampirkan foto Surat Keterangan Dokter di bawah.</p>
            </div>
          )}
          {type === "Izin Pribadi" && (
            <div className="mb-4 bg-orange-500/20 border border-orange-500/30 p-3 rounded-xl flex items-start space-x-3">
              <i className="fa-solid fa-triangle-exclamation text-orange-400 mt-0.5"></i>
              <p className="text-xs text-orange-100">Izin Pribadi tanpa surat dokter berlaku <strong className="text-white">No Work, No Pay</strong> (Alpha).</p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs text-pilar-textSecondary mb-2 uppercase tracking-wider">Jenis Cuti</label>
            <div className="relative">
              <select 
                value={type} 
                onChange={(e) => setType(e.target.value as PengajuanType)}
                className="w-full bg-pilar-darker border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-pilar-gold appearance-none text-white"
              >
                <option value="Cuti Tahunan" className="bg-[#00142f] text-white">Cuti Tahunan</option>
                <option value="Cuti Lembur" className="bg-[#00142f] text-white">Cuti Lembur (Kompensasi)</option>
                <option value="Cuti Tanpa Bayar" className="bg-[#00142f] text-white">Cuti Tanpa Bayar (Unpaid Leave)</option>
                <option value="Cuti Sakit" className="bg-[#00142f] text-white">Cuti Sakit</option>
                <option value="Cuti Haid" className="bg-[#00142f] text-white">Cuti Haid</option>
                <option value="Cuti Melahirkan" className="bg-[#00142f] text-white">Cuti Melahirkan / Keguguran</option>
                <option value="Cuti Khusus" className="bg-[#00142f] text-white">Cuti Khusus (Menikah, Duka, dll)</option>
                <option value="Izin Pribadi" className="bg-[#00142f] text-white">Izin Pribadi</option>
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                <i className="fa-solid fa-chevron-down text-gray-400 text-xs"></i>
              </div>
            </div>
          </div>

          {type === "Cuti Khusus" && (
            <div className="mb-4 animate-in fade-in slide-in-from-top-2">
              <label className="block text-xs text-pilar-textSecondary mb-2 uppercase tracking-wider">Kategori Cuti Khusus</label>
              <div className="relative">
                <select 
                  className="w-full bg-pilar-darker border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-pilar-gold appearance-none text-white"
                >
                  <option>Pilih Kategori...</option>
                  <option>Menikah (3 Hari)</option>
                  <option>Menikahkan Anak (2 Hari)</option>
                  <option>Mengkhitankan / Membaptis Anak (2 Hari)</option>
                  <option>Istri Melahirkan / Keguguran (2 Hari)</option>
                  <option>Keluarga Inti Meninggal (2 Hari)</option>
                  <option>Anggota Keluarga Serumah Meninggal (1 Hari)</option>
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                  <i className="fa-solid fa-chevron-down text-gray-400 text-xs"></i>
                </div>
              </div>
            </div>
          )}

          <div className="mb-4 p-4 bg-pilar-darker rounded-xl border border-white/5">
            <h3 className="text-[10px] font-bold text-pilar-textSecondary uppercase tracking-widest mb-3 border-b border-white/10 pb-2">Periode Cuti</h3>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Mulai</label>
                <input 
                  type="date" 
                  required
                  min={minDateAllowed}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-pilar-gold text-pilar-textPrimary"
                  style={{ colorScheme: "dark" }}
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Masuk Kembali</label>
                <input 
                  type="date" 
                  required
                  min={startDate || minDateAllowed}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-pilar-gold text-pilar-textPrimary"
                  style={{ colorScheme: "dark" }}
                />
              </div>
            </div>
            {startDate && new Date(startDate) < new Date(minDateAllowed) && !editId && (
              <div className="bg-red-500/10 text-red-400 text-xs px-3 py-2 mb-3 rounded-lg text-center font-medium border border-red-500/20">
                Tanggal mulai pengajuan baru harus minimal 30 hari dari sekarang.
              </div>
            )}
            {duration > 0 && (
              <div className="bg-pilar-gold/10 text-pilar-gold text-xs px-3 py-2 rounded-lg text-center font-medium border border-pilar-gold/20">
                Lama Cuti: {duration} Hari
              </div>
            )}
            {duration === 0 && startDate && endDate && (
              <div className="bg-red-500/10 text-red-400 text-xs px-3 py-2 rounded-lg text-center font-medium border border-red-500/20">
                Tanggal masuk harus lebih dari tanggal mulai.
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-white/5 flex items-start space-x-2 text-[10px] text-gray-400 leading-relaxed">
              <i className="fa-solid fa-circle-info mt-0.5 text-pilar-gold"></i>
              <p><strong>Catatan Penting:</strong> Sesuai dengan kebijakan perusahaan, pengajuan cuti wajib dilakukan selambat-lambatnya <strong>30 hari</strong> sebelum tanggal mulai cuti.</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-pilar-textSecondary mb-2 uppercase tracking-wider">Keterangan / Alasan</label>
            <textarea 
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan secara detail alasan pengajuan..."
              className="w-full bg-pilar-darker border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-pilar-gold min-h-[80px] resize-none text-white placeholder-gray-500"
            ></textarea>
          </div>

          <div className="mb-6">
            <label className="block text-xs text-pilar-textSecondary mb-2 uppercase tracking-wider">Catatan Lainnya (Opsional)</label>
            <textarea 
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Tambahkan catatan lain jika diperlukan..."
              className="w-full bg-pilar-darker border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pilar-gold min-h-[60px] resize-none text-white placeholder-gray-500"
            ></textarea>
          </div>

          {/* Pelimpahan Tugas */}
          <div className="mb-6 p-4 bg-pilar-darker rounded-xl border border-pilar-gold/30 relative">
            <div className="absolute -top-2.5 left-4 bg-pilar-darker px-2 text-[10px] font-bold text-pilar-gold uppercase tracking-widest">
              Pelimpahan Tugas
            </div>
            <p className="text-[10px] text-gray-400 mb-3 mt-1">Tugas & wewenang selama cuti dilimpahkan kepada:</p>
            <div className="space-y-3">
              <div className="relative">
                <select 
                  value={delegationId || ""}
                  onChange={(e) => {
                    const empId = e.target.value;
                    if (!empId) {
                      setDelegationName("");
                      setDelegationId("");
                      setDelegationRole("");
                      setDelegationNik("");
                      return;
                    }
                    const emp = allEmployees.find((e) => e.id === empId);
                    if (emp) {
                      setDelegationId(emp.id);
                      setDelegationName(emp.nama);
                      setDelegationRole(emp.posisi || emp.divisi || "");
                      setDelegationNik(emp.noInduk || emp.karyawanId || `PLR-${emp.id.substring(0,6).toUpperCase()}`);
                    }
                  }}
                  required
                  className="w-full bg-pilar-darker border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-pilar-gold appearance-none text-white"
                >
                  <option value="" disabled hidden className="bg-[#00142f] text-white">Pilih Nama Pengganti</option>
                  {allEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id} className="bg-[#00142f] text-white">
                      {emp.nama}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                  <i className="fa-solid fa-chevron-down text-gray-400 text-xs"></i>
                </div>
              </div>
              
              {delegationName && (
                <div className="bg-black/20 border border-white/10 rounded-xl p-4 flex flex-col space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex flex-col space-y-1.5">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">No. Induk / NIK</span>
                    <span className="text-sm font-mono text-gray-300 bg-white/5 px-3 py-2 rounded-lg border border-white/5 break-all">{delegationNik || "-"}</span>
                  </div>
                  <div className="flex flex-col space-y-1.5">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Jabatan</span>
                    <span className="text-sm font-bold text-pilar-gold bg-pilar-gold/10 px-3 py-2 rounded-lg border border-pilar-gold/20 break-words">{delegationRole || "-"}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {needsAttachment && (
            <div className="mb-8 animate-in fade-in slide-in-from-top-2">
              <label className="block text-xs text-pilar-textSecondary mb-2 uppercase tracking-wider">Lampiran Dokumen (Maks. 5 File)</label>
              <div className="relative w-full bg-pilar-darker border border-dashed border-white/20 rounded-xl p-4 text-sm focus-within:border-pilar-gold transition-colors hover:bg-white/5 cursor-pointer">
                <input 
                  type="file" 
                  multiple
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.doc,.docx"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={attachments.length >= 5}
                />
                <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none py-2">
                  <i className={`fa-solid ${attachments.length > 0 ? 'fa-file-circle-check text-green-400' : 'fa-cloud-arrow-up text-pilar-textSecondary'} text-2xl`}></i>
                  <span className={`text-center font-medium ${attachments.length > 0 ? 'text-white' : 'text-pilar-textSecondary'}`}>
                    {attachments.length > 0 ? `${attachments.length} file dilampirkan` : "Ketuk untuk melampirkan dokumen persetujuan/surat dokter"}
                  </span>
                </div>
              </div>
              
              {attachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {attachments.map((file, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white/5 px-3 py-2 rounded-lg border border-white/10">
                      <div className="flex items-center space-x-2 truncate w-4/5">
                        <i className="fa-solid fa-file-lines text-pilar-gold text-xs"></i>
                        <span className="text-xs text-gray-300 truncate">{file.name}</span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => removeFile(idx)}
                        className="text-red-400 hover:text-red-300 ml-2 w-6 h-6 flex items-center justify-center rounded-full bg-red-400/10"
                      >
                        <i className="fa-solid fa-xmark text-xs"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

            <button 
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center space-x-2 transition-all ${
                isSubmitting ? "bg-gray-500 text-gray-300 cursor-not-allowed" : "bg-pilar-gold text-pilar-darker hover:bg-white hover:shadow-lg"
              }`}
            >
              {isSubmitting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane"></i>
                  <span>{editId ? "Kirim Perbaikan" : "Kirim Pengajuan"}</span>
                </>
              )}
            </button>
        </form>
          </div>
        )}

        {!isFormOpen && (
          <div className="animate-fade-in space-y-4">
            <div className="bg-white/5 p-5 rounded-2xl border border-white/10 mb-8 flex flex-col items-center text-center shadow-lg relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-pilar-gold/10 rounded-full blur-2xl"></div>
              <h3 className="text-lg font-bold text-white mb-2 relative z-10">Punya Rencana Cuti?</h3>
              <p className="text-xs text-pilar-textSecondary mb-5 relative z-10">Ajukan cuti, izin, atau sakit Anda dengan mudah melalui form pengajuan.</p>
              <button 
                onClick={() => setIsFormOpen(true)}
                className="bg-pilar-gold text-pilar-darker font-bold py-3 px-6 rounded-xl w-full flex items-center justify-center space-x-2 hover:bg-[#b8962c] transition relative z-10"
              >
                <i className="fa-solid fa-plus text-lg"></i>
                <span>Ajukan Cuti</span>
              </button>
            </div>
            
            <h3 className="font-bold text-white mb-4 flex items-center">
              <i className="fa-solid fa-clock-rotate-left mr-2 text-pilar-gold"></i> 
              Riwayat Pengajuan
            </h3>

            {pengajuanList.length > 0 ? (
              pengajuanList.map((item) => (
                <div key={item.id} className="bg-white/5 p-4 rounded-xl flex flex-col border border-white/10 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${getStatusStyle(item.status)}`}>
                        <i className={`fa-solid ${getStatusIcon(item.status)}`}></i>
                      </div>
                      <div>
                        <p className="font-bold text-sm text-white">{item.type}</p>
                        <p className="text-[10px] text-gray-400">{item.startDate} s/d {item.endDate}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${getStatusStyle(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                  
                  {item.status === "Revisi" && (
                    <div className="mt-3 bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
                      <p className="text-[10px] font-bold text-red-400 mb-1 uppercase">Catatan HRD:</p>
                      <p className="text-xs text-white mb-3 italic">"{item.alasanPenolakan}"</p>
                      <button 
                        onClick={() => {
                          setEditId(item.id);
                          setType(item.type);
                          setStartDate(item.startDate);
                          setEndDate(item.endDate);
                          setReason(item.reason);
                          setAdditionalNotes(item.additionalNotes || "");
                          setDelegationName(item.delegationName || "");
                          setDelegationId(item.delegationId || "");
                          setDelegationRole(item.delegationRole || "");
                          setIsFormOpen(true);
                          window.scrollTo(0,0);
                        }}
                        className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs py-2 rounded transition-colors flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-pen"></i> Perbaiki Pengajuan
                      </button>
                    </div>
                  )}
                  
                  {item.status !== "Revisi" && (
                    <div className="mt-2 text-xs text-gray-400 bg-black/20 p-2 rounded">
                      <span className="font-semibold text-gray-300">Keterangan:</span> {item.reason}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-10 bg-white/5 rounded-xl border border-dashed border-white/10">
                <i className="fa-solid fa-folder-open text-3xl text-pilar-textSecondary mb-3"></i>
                <p className="text-sm text-pilar-textSecondary">Belum ada riwayat pengajuan cuti/izin.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 w-full bg-pilar-darker border-t border-white/10 px-6 py-4 flex justify-between items-center z-20">
        <Link href="/" className="flex flex-col items-center text-pilar-textSecondary hover:text-pilar-textPrimary transition-colors">
          <i className="fa-solid fa-house text-xl mb-1"></i>
          <span className="text-[10px] font-medium">Beranda</span>
        </Link>
        <Link href="/riwayat" className="flex flex-col items-center text-pilar-textSecondary hover:text-pilar-textPrimary transition-colors">
          <i className="fa-solid fa-clock-rotate-left text-xl mb-1"></i>
          <span className="text-[10px] font-medium">Riwayat</span>
        </Link>
        <Link href="/pengajuan" className="flex flex-col items-center text-pilar-gold">
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
