"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import NotificationBell from "@/components/NotificationBell";
import Toast from "@/components/Toast";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut, updatePassword, updateProfile, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { getEmployee, updateEmployeeProfile } from "@/lib/db";

export default function PengaturanPage() {
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fullscreen Modals State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Edit Profile Form State
  const [editNama, setEditNama] = useState("");
  const [editNoWa, setEditNoWa] = useState("");
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToastType(type);
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 3000);
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const emp = await getEmployee(user.uid);
          if (emp) {
            setCurrentUser(emp);
          } else {
            setCurrentUser({
              id: user.uid,
              nama: user.displayName || user.email?.split("@")[0] || "Karyawan",
              email: user.email,
              posisi: "Karyawan",
              status: "Aktif",
              foto: user.photoURL || ""
            });
          }
        } catch (err) {
          console.error("Gagal mengambil data profil:", err);
        }
      } else {
        window.location.href = "/login";
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openEditProfile = () => {
    setEditNama(currentUser?.nama || "");
    setEditNoWa(currentUser?.noWa || "");
    setPreviewFoto(currentUser?.foto || null);
    setIsUploadingPhoto(false);
    setUploadProgress(0);
    setIsProfileModalOpen(true);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return showToast("File harus berupa gambar (JPG, PNG, atau WEBP).", "error");
    }

    if (file.size > 5 * 1024 * 1024) {
      return showToast("Ukuran foto maksimal 5 MB.", "error");
    }

    if (!currentUser?.id) {
      return showToast("Sesi akun tidak valid.", "error");
    }

    const oldPhotoUrl = currentUser?.foto;

    // 1. Tampilkan preview lokal langsung
    const localPreview = URL.createObjectURL(file);
    setPreviewFoto(localPreview);
    setIsUploadingPhoto(true);
    setUploadProgress(10);

    // 2. Upload langsung dengan progress tracking
    try {
      const uploadedUrl = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append("files", file);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            // Rentang 15% - 90% saat proses transmisi jaringan
            const percent = Math.min(90, Math.max(15, Math.round((event.loaded / event.total) * 90)));
            setUploadProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              setUploadProgress(100);
              if (res.files && res.files.length > 0) {
                resolve(res.files[0].url);
              } else {
                reject(new Error("URL foto tidak ditemukan pada respon"));
              }
            } catch (err) {
              reject(new Error("Respon server tidak valid"));
            }
          } else {
            try {
              const res = JSON.parse(xhr.responseText);
              reject(new Error(res.error || "Gagal mengunggah foto"));
            } catch {
              reject(new Error("Gagal mengunggah foto ke server"));
            }
          }
        };

        xhr.onerror = () => reject(new Error("Koneksi internet bermasalah"));
        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });

      // 3. Simpan URL foto langsung ke Database & Firebase Auth
      await updateEmployeeProfile(currentUser.id, { foto: uploadedUrl });

      if (auth?.currentUser) {
        try {
          await updateProfile(auth.currentUser, { photoURL: uploadedUrl });
        } catch (authErr) {
          console.warn("Gagal update auth photoURL:", authErr);
        }
      }

      // 4. Hapus foto lama dari Cloudflare R2 jika ada
      if (oldPhotoUrl && oldPhotoUrl !== uploadedUrl) {
        fetch("/api/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: oldPhotoUrl })
        }).catch((err) => console.warn("Gagal menghapus foto lama dari storage:", err));
      }

      // 5. Perbarui state lokal
      setCurrentUser((prev: any) => ({ ...prev, foto: uploadedUrl }));
      setPreviewFoto(uploadedUrl);
      showToast("Foto profil berhasil diunggah!");
    } catch (err: any) {
      console.error("Upload error:", err);
      showToast(err.message || "Gagal mengunggah foto profil.", "error");
      // Rollback ke foto sebelumnya jika gagal
      setPreviewFoto(currentUser?.foto || null);
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemovePhoto = async () => {
    if (!currentUser?.id) return;
    const oldPhotoUrl = currentUser?.foto;
    try {
      await updateEmployeeProfile(currentUser.id, { foto: "" });
      if (auth?.currentUser) {
        try {
          await updateProfile(auth.currentUser, { photoURL: "" });
        } catch (authErr) {
          console.warn("Gagal update auth photoURL:", authErr);
        }
      }

      // Hapus file dari Cloudflare R2
      if (oldPhotoUrl) {
        fetch("/api/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: oldPhotoUrl })
        }).catch((err) => console.warn("Gagal menghapus foto dari storage:", err));
      }

      setCurrentUser((prev: any) => ({ ...prev, foto: "" }));
      setPreviewFoto(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      showToast("Foto profil berhasil dihapus.");
    } catch (err) {
      console.error(err);
      showToast("Gagal menghapus foto profil.", "error");
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNama.trim()) {
      return showToast("Nama lengkap tidak boleh kosong.", "error");
    }

    if (!currentUser?.id) {
      return showToast("ID pengguna tidak valid.", "error");
    }

    setIsSavingProfile(true);
    try {
      // Simpan perubahan nama dan nomor WhatsApp
      const updatePayload: any = {
        nama: editNama.trim(),
        noWa: editNoWa.trim()
      };

      const success = await updateEmployeeProfile(currentUser.id, updatePayload);
      if (!success) {
        throw new Error("Gagal menyimpan perubahan ke database.");
      }

      // Update Firebase Auth displayName
      if (auth?.currentUser) {
        try {
          await updateProfile(auth.currentUser, {
            displayName: editNama.trim()
          });
        } catch (authErr) {
          console.warn("Gagal update auth profile:", authErr);
        }
      }

      // Update local state
      setCurrentUser((prev: any) => ({
        ...prev,
        nama: editNama.trim(),
        noWa: editNoWa.trim()
      }));

      showToast("Profil berhasil diperbarui!");
      setIsProfileModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Terjadi kesalahan saat memperbarui profil.", "error");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      if (auth) {
        await signOut(auth);
      }
      localStorage.removeItem("pilar_user");
      localStorage.removeItem("user_email");
      localStorage.removeItem("pilar_logged_in");
      localStorage.removeItem("pilar_today_attendance");
      sessionStorage.removeItem("pilar_session_checked");
      sessionStorage.removeItem("pilar_cached_employee");
    } catch (e) {
      console.error("Gagal logout:", e);
    }
    setTimeout(() => {
      window.location.href = "/login";
    }, 600);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      return showToast("Harap masukkan kata sandi Anda saat ini.", "error");
    }
    if (!newPassword || !confirmPassword) {
      return showToast("Harap isi semua kolom kata sandi baru.", "error");
    }
    if (newPassword.length < 6) {
      return showToast("Kata sandi baru minimal 6 karakter.", "error");
    }
    if (newPassword !== confirmPassword) {
      return showToast("Konfirmasi kata sandi tidak cocok.", "error");
    }

    if (!auth?.currentUser || !auth.currentUser.email) {
      return showToast("Sesi tidak valid, silakan login ulang.", "error");
    }

    setIsUpdatingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      showToast("Kata sandi berhasil diperbarui!");
      setIsPasswordModalOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error(err);
      if (err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password") {
        showToast("Kata sandi saat ini salah.", "error");
      } else if (err?.code === "auth/requires-recent-login") {
        showToast("Demi keamanan, silakan keluar dan login ulang sebelum mengganti sandi.", "error");
      } else {
        showToast("Gagal memperbarui sandi: " + (err?.message || "Terjadi kesalahan"), "error");
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "P";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="mobile-container flex flex-col text-pilar-textPrimary mx-auto shadow-2xl relative">
      {/* Header */}
      <header className="pt-10 pb-6 px-6 bg-pilar-darker rounded-b-3xl shadow-md z-10 relative">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold font-heading text-pilar-textPrimary">
              Pengaturan
            </h1>
            <h2 className="text-xs text-pilar-textSecondary tracking-wider">
              Preferensi Akun & Aplikasi
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
              type={toastType}
              description={toastMessage} 
              onClose={() => setToastMessage("")} 
            />
          </div>
        )}

        {/* Profile Card Section */}
        <div className="bg-white/5 rounded-2xl p-5 mb-6 border border-white/10 flex items-center space-x-4 backdrop-blur-sm relative overflow-hidden">
          <div className="w-16 h-16 rounded-full bg-pilar-darker border-2 border-pilar-gold flex items-center justify-center text-pilar-gold text-2xl font-bold shrink-0 shadow-inner overflow-hidden">
            {loading ? (
              <i className="fa-solid fa-circle-notch fa-spin text-lg"></i>
            ) : currentUser?.foto ? (
              <img 
                src={currentUser.foto} 
                alt={currentUser.nama} 
                className="w-full h-full object-cover"
              />
            ) : (
              getInitials(currentUser?.nama)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-lg text-white truncate">
                {loading ? "Memuat..." : (currentUser?.nama || "Karyawan")}
              </h3>
            </div>
            <p className="text-sm text-pilar-textSecondary truncate">
              {loading ? "-" : (currentUser?.posisi || "Karyawan")}
            </p>
            <p className="text-xs text-pilar-textSecondary mt-0.5 truncate">
              {loading ? "-" : (currentUser?.email || "-")}
            </p>
          </div>
        </div>

        {/* Settings List */}
        <div className="space-y-4 mb-8">
          <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            <button 
              onClick={openEditProfile}
              className="w-full flex justify-between items-center p-4 hover:bg-white/10 transition text-left"
            >
              <div className="flex items-center space-x-3">
                <i className="fa-solid fa-user-pen text-pilar-gold w-5 text-center"></i>
                <span className="text-sm font-medium">Informasi & Edit Profil</span>
              </div>
              <i className="fa-solid fa-chevron-right text-pilar-textSecondary text-xs"></i>
            </button>
            <div className="h-px bg-white/10 w-full"></div>
            <button 
              onClick={() => setIsPasswordModalOpen(true)}
              className="w-full flex justify-between items-center p-4 hover:bg-white/10 transition text-left"
            >
              <div className="flex items-center space-x-3">
                <i className="fa-solid fa-key text-pilar-gold w-5 text-center"></i>
                <span className="text-sm font-medium">Ubah Kata Sandi</span>
              </div>
              <i className="fa-solid fa-chevron-right text-pilar-textSecondary text-xs"></i>
            </button>
          </div>

          <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            <div className="flex justify-between items-center p-4">
              <div className="flex items-center space-x-3">
                <i className="fa-solid fa-shield-halved text-pilar-gold w-5 text-center"></i>
                <span className="text-sm font-medium">Status Akun</span>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                {currentUser?.status || "Aktif"}
              </span>
            </div>
            <div className="h-px bg-white/10 w-full"></div>
            <div className="flex justify-between items-center p-4">
              <div className="flex items-center space-x-3">
                <i className="fa-solid fa-language text-pilar-gold w-5 text-center"></i>
                <span className="text-sm font-medium">Bahasa</span>
              </div>
              <span className="text-xs text-pilar-textSecondary font-medium">Indonesia</span>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`w-full bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl p-4 font-bold transition flex items-center justify-center space-x-2 ${isLoggingOut ? 'opacity-70 cursor-not-allowed' : 'hover:bg-red-500/30 active:scale-[0.99]'}`}
        >
          {isLoggingOut ? (
            <i className="fa-solid fa-spinner fa-spin"></i>
          ) : (
            <i className="fa-solid fa-arrow-right-from-bracket"></i>
          )}
          <span>{isLoggingOut ? "Keluar..." : "Keluar"}</span>
        </button>
      </main>

      {/* FULL-SCREEN MODAL: EDIT PROFIL & FOTO */}
      {isProfileModalOpen && (
        <div className="absolute inset-0 z-50 bg-pilar-dark flex flex-col text-pilar-textPrimary animate-slide-up">
          {/* Header */}
          <div className="pt-10 pb-4 px-6 bg-pilar-darker border-b border-white/10 flex items-center justify-between shrink-0">
            <button 
              onClick={() => setIsProfileModalOpen(false)}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-pilar-textSecondary hover:text-white transition-colors"
            >
              <i className="fa-solid fa-arrow-left text-lg"></i>
            </button>
            <h2 className="text-base font-bold text-white font-heading">
              Edit Profil Karyawan
            </h2>
            <div className="w-10"></div>
          </div>

          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto scrollable-content px-6 py-6 pb-28">
            <div className="space-y-6 max-w-md mx-auto">
              {/* Photo Upload Card */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center backdrop-blur-sm relative">
                <div className="relative inline-block mx-auto mb-4">
                  <div className="w-28 h-28 rounded-full border-4 border-pilar-gold/60 bg-pilar-darker flex items-center justify-center text-pilar-gold text-4xl font-black shadow-2xl overflow-hidden relative">
                    {previewFoto ? (
                      <img 
                        src={previewFoto} 
                        alt="Preview Foto" 
                        className={`w-full h-full object-cover transition-opacity duration-300 ${isUploadingPhoto ? "opacity-30 scale-105" : "opacity-100 scale-100"}`}
                      />
                    ) : (
                      getInitials(editNama || currentUser?.nama)
                    )}

                    {/* Animated Circular Progress Overlay */}
                    {isUploadingPhoto && (
                      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center text-center p-2 z-10 animate-fade-in">
                        <div className="relative w-14 h-14 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90 drop-shadow-md" viewBox="0 0 36 36">
                            {/* Track */}
                            <path
                              className="text-white/20"
                              strokeWidth="3.5"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            {/* Progress Ring */}
                            <path
                              className="text-pilar-gold transition-all duration-200 ease-out"
                              strokeDasharray={`${uploadProgress}, 100`}
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                          </svg>
                          <div className="absolute flex flex-col items-center justify-center">
                            <span className="text-[12px] font-black text-pilar-gold leading-none">
                              {uploadProgress}%
                            </span>
                          </div>
                        </div>
                        <span className="text-[9px] font-bold text-white tracking-widest uppercase mt-1 animate-pulse">
                          Mengunggah...
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Photo Action Camera Badge */}
                  <label 
                    htmlFor="foto-input" 
                    className={`absolute bottom-0 right-0 w-10 h-10 rounded-full bg-pilar-gold text-pilar-darker flex items-center justify-center cursor-pointer shadow-lg border-2 border-pilar-dark hover:scale-105 active:scale-95 transition-all ${isUploadingPhoto ? "pointer-events-none opacity-50" : ""}`}
                    title="Pilih Foto"
                  >
                    {isUploadingPhoto ? (
                      <i className="fa-solid fa-spinner fa-spin text-sm"></i>
                    ) : (
                      <i className="fa-solid fa-camera text-sm"></i>
                    )}
                  </label>
                  <input 
                    id="foto-input"
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*" 
                    onChange={handlePhotoChange}
                    disabled={isUploadingPhoto}
                    className="hidden" 
                  />
                </div>

                <div className="flex items-center justify-center space-x-3">
                  <label 
                    htmlFor="foto-input"
                    className={`text-xs font-bold text-pilar-gold bg-pilar-gold/10 hover:bg-pilar-gold/20 px-4 py-2 rounded-full border border-pilar-gold/30 cursor-pointer transition-colors flex items-center space-x-1.5 ${isUploadingPhoto ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <i className={`fa-solid ${isUploadingPhoto ? "fa-spinner fa-spin" : "fa-upload"} text-xs`}></i>
                    <span>{isUploadingPhoto ? "Mengunggah..." : previewFoto ? "Ganti Foto" : "Pilih Foto"}</span>
                  </label>
                  {previewFoto && !isUploadingPhoto && (
                    <button 
                      type="button"
                      onClick={handleRemovePhoto}
                      className="text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 px-4 py-2 rounded-full border border-red-500/30 transition-colors flex items-center space-x-1.5"
                    >
                      <i className="fa-solid fa-trash text-xs"></i>
                      <span>Hapus</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-pilar-textSecondary mt-2.5">
                  {isUploadingPhoto 
                    ? "Sedang mengunggah foto ke penyimpanan cloud..." 
                    : "Format gambar JPG, PNG, atau WEBP (maks. 5MB)."}
                </p>
              </div>

              {/* Employee Information (Read-only) */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-pilar-gold uppercase tracking-wider">
                  Informasi Karyawan
                </h3>

                <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5">
                  <span className="text-[11px] text-pilar-textSecondary block mb-0.5">Nama Lengkap</span>
                  <span className="font-semibold text-white text-sm truncate block">{currentUser?.nama || "-"}</span>
                </div>

                <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5">
                  <span className="text-[11px] text-pilar-textSecondary block mb-0.5">Nomor WhatsApp / HP</span>
                  <span className="font-semibold text-white text-sm truncate block">{currentUser?.noWa || "-"}</span>
                </div>
              </div>

              {/* Company Assigned Information (Read-only) */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-pilar-gold uppercase tracking-wider">
                  Data Kepegawaian
                </h3>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 overflow-hidden">
                    <span className="text-[11px] text-pilar-textSecondary block mb-0.5">Jabatan / Posisi</span>
                    <span className="font-semibold text-white text-sm truncate block">{currentUser?.posisi || "-"}</span>
                  </div>
                  <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 overflow-hidden">
                    <span className="text-[11px] text-pilar-textSecondary block mb-0.5 truncate">Nomor Induk (NIK)</span>
                    <span className="font-semibold text-white text-sm truncate block">{currentUser?.noInduk || "-"}</span>
                  </div>
                </div>

                <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5">
                  <span className="text-[11px] text-pilar-textSecondary block mb-0.5">Email Akun Perusahaan</span>
                  <span className="font-semibold text-white text-sm truncate block">{currentUser?.email || "-"}</span>
                </div>

                <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-pilar-textSecondary block mb-0.5">Jam Shift Kerja</span>
                    <span className="font-semibold text-white text-sm">
                      {currentUser?.shiftMasuk && currentUser?.shiftKeluar 
                        ? `${currentUser.shiftMasuk} - ${currentUser.shiftKeluar}` 
                        : "08:00 - 17:00"}
                    </span>
                  </div>
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-pilar-gold/10 text-pilar-gold font-bold border border-pilar-gold/30">
                    Reguler
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN MODAL: UBAH KATA SANDI */}
      {isPasswordModalOpen && (
        <div className="absolute inset-0 z-50 bg-pilar-dark flex flex-col text-pilar-textPrimary animate-slide-up">
          {/* Header */}
          <div className="pt-10 pb-4 px-6 bg-pilar-darker border-b border-white/10 flex items-center justify-between shrink-0">
            <button 
              onClick={() => setIsPasswordModalOpen(false)}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-pilar-textSecondary hover:text-white transition-colors"
            >
              <i className="fa-solid fa-arrow-left text-lg"></i>
            </button>
            <h2 className="text-base font-bold text-white font-heading">
              Ubah Kata Sandi
            </h2>
            <div className="w-10"></div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto scrollable-content px-6 py-6 pb-28">
            <form onSubmit={handleUpdatePassword} className="space-y-6 max-w-md mx-auto">
              {/* Illustration / Badge */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center backdrop-blur-sm">
                <div className="w-16 h-16 rounded-2xl bg-pilar-gold/10 border border-pilar-gold/30 text-pilar-gold flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <i className="fa-solid fa-shield-halved text-2xl"></i>
                </div>
                <h3 className="font-bold text-white text-base mb-1">Amankan Akun Anda</h3>
                <p className="text-xs text-pilar-textSecondary">
                  Pastikan kata sandi baru Anda unik dan memiliki minimal 6 karakter.
                </p>
              </div>

              {/* Password Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-pilar-textSecondary block mb-1.5 font-medium">
                    Kata Sandi Saat Ini <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-pilar-textSecondary">
                      <i className="fa-solid fa-key text-sm"></i>
                    </span>
                    <input 
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Masukkan sandi Anda saat ini"
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-11 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pilar-gold focus:ring-1 focus:ring-pilar-gold text-sm"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-pilar-textSecondary hover:text-white transition-colors"
                    >
                      <i className={`fa-solid ${showCurrentPassword ? "fa-eye-slash" : "fa-eye"} text-sm`}></i>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-pilar-textSecondary block mb-1.5 font-medium">
                    Kata Sandi Baru <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-pilar-textSecondary">
                      <i className="fa-solid fa-lock text-sm"></i>
                    </span>
                    <input 
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-11 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pilar-gold focus:ring-1 focus:ring-pilar-gold text-sm"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-pilar-textSecondary hover:text-white transition-colors"
                    >
                      <i className={`fa-solid ${showNewPassword ? "fa-eye-slash" : "fa-eye"} text-sm`}></i>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-pilar-textSecondary block mb-1.5 font-medium">
                    Konfirmasi Kata Sandi Baru <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-pilar-textSecondary">
                      <i className="fa-solid fa-lock-check text-sm"></i>
                    </span>
                    <input 
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi kata sandi baru"
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-11 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pilar-gold focus:ring-1 focus:ring-pilar-gold text-sm"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-pilar-textSecondary hover:text-white transition-colors"
                    >
                      <i className={`fa-solid ${showConfirmPassword ? "fa-eye-slash" : "fa-eye"} text-sm`}></i>
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Requirement Checklist */}
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2 text-xs">
                <div className={`flex items-center space-x-2 ${newPassword.length >= 6 ? "text-emerald-400" : "text-pilar-textSecondary"}`}>
                  <i className={`fa-solid ${newPassword.length >= 6 ? "fa-circle-check" : "fa-circle-dot"}`}></i>
                  <span>Minimal 6 karakter</span>
                </div>
                <div className={`flex items-center space-x-2 ${newPassword && confirmPassword && newPassword === confirmPassword ? "text-emerald-400" : "text-pilar-textSecondary"}`}>
                  <i className={`fa-solid ${newPassword && confirmPassword && newPassword === confirmPassword ? "fa-circle-check" : "fa-circle-dot"}`}></i>
                  <span>Konfirmasi kata sandi cocok</span>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button 
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="w-full bg-pilar-gold text-pilar-darker font-extrabold py-3.5 rounded-2xl hover:bg-amber-400 active:scale-[0.99] transition-all text-sm shadow-xl flex items-center justify-center space-x-2"
                >
                  {isUpdatingPassword ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Memperbarui Sandi...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-key"></i>
                      <span>Perbarui Kata Sandi</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
        <Link href="/pengajuan" className="flex flex-col items-center text-pilar-textSecondary hover:text-pilar-textPrimary transition-colors">
          <i className="fa-solid fa-file-invoice text-xl mb-1"></i>
          <span className="text-[10px] font-medium">Pengajuan</span>
        </Link>
        <Link href="/gaji" className="flex flex-col items-center text-pilar-textSecondary hover:text-pilar-textPrimary transition-colors">
          <i className="fa-solid fa-sack-dollar text-xl mb-1"></i>
          <span className="text-[10px] font-medium">Gaji</span>
        </Link>
        <Link href="/pengaturan" className="flex flex-col items-center text-pilar-gold">
          <i className="fa-solid fa-cog text-xl mb-1"></i>
          <span className="text-[10px] font-medium">Pengaturan</span>
        </Link>
      </nav>
    </div>
  );
}

