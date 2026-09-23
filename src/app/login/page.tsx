"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Bersihkan sisa sesi lama jika di halaman login tanpa user aktif
  useEffect(() => {
    if (auth && !auth.currentUser) {
      document.cookie = "pilar_employee_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
  }, []);

  const validateEmail = (val: string) => {
    if (!val) return "Email wajib diisi";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "Format email tidak valid";
    return "";
  };

  const validatePassword = (val: string) => {
    if (!val) return "Kata sandi wajib diisi";
    if (val.length < 6) return "Kata sandi minimal 6 karakter";
    return "";
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    setEmailError(validateEmail(val));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    setPasswordError(validatePassword(val));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Final check before submit
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    
    if (eErr || pErr) {
      setEmailError(eErr);
      setPasswordError(pErr);
      return;
    }

    setIsLoading(true);
    setError("");

    if (!auth) {
      setError("Firebase belum terkonfigurasi. Periksa file .env.");
      setIsLoading(false);
      return;
    }

    try {
      const trimmedEmail = email.trim().toLowerCase();
      // 1. Otentikasi langsung via Firebase Client SDK
      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      const user = userCredential.user;
      const uid = user.uid;
      const idToken = await user.getIdToken();

      let employeeData: any = null;

      // 2. Cek langsung data karyawan di Firestore via Client SDK (sangat cepat ~50-100ms)
      if (db) {
        try {
          const empDoc = await getDoc(doc(db, "employees", uid));
          if (empDoc.exists()) {
            employeeData = { id: empDoc.id, ...empDoc.data() };
          } else {
            // Cek berdasarkan email
            const empQuery = await getDocs(query(collection(db, "employees"), where("email", "==", trimmedEmail)));
            if (!empQuery.empty) {
              employeeData = { id: empQuery.docs[0].id, ...empQuery.docs[0].data() };
            }
          }
        } catch (dbErr) {
          console.warn("Client Firestore employee lookup notice:", dbErr);
        }
      }

      // 3. Fallback ke endpoint server jika client SDK belum dapat data
      if (!employeeData) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);
          const res = await fetch('/api/auth/verify-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            const roleData = await res.json();
            if (roleData.isAdmin) {
              await auth.signOut();
              setError("Akun ini terdaftar sebagai Administrator. Silakan login melalui portal Admin.");
              setIsLoading(false);
              return;
            }
            if (roleData.isEmployee) {
              employeeData = {
                id: uid,
                status: roleData.employeeStatus || "Aktif",
                nama: roleData.nama || "",
                nik: roleData.nik || "",
                email: trimmedEmail
              };
            }
          }
        } catch (serverErr) {
          console.warn("Server verify-role fallback notice:", serverErr);
        }
      }

      // 4. Jika tetap tidak ditemukan di employees, periksa secara aman apakah akun ini admin
      if (!employeeData) {
        let isAdminAccount = trimmedEmail === 'pilarss@admin.com';
        if (!isAdminAccount && db) {
          try {
            const admDoc = await getDoc(doc(db, "admins", uid));
            if (admDoc.exists()) isAdminAccount = true;
          } catch {
            // Abaikan permission-denied jika bukan admin
          }
        }

        if (isAdminAccount) {
          await auth.signOut();
          setError("Akun ini terdaftar sebagai Administrator. Silakan login melalui portal Admin.");
          setIsLoading(false);
          return;
        }

        await auth.signOut();
        setError("Akun karyawan tidak ditemukan atau belum terdaftar.");
        setIsLoading(false);
        return;
      }

      // 5. Cek status aktif karyawan
      if (employeeData.status === 'Nonaktif') {
        await auth.signOut();
        setError("Akun Anda berstatus Nonaktif. Silakan hubungi pihak HRD.");
        setIsLoading(false);
        return;
      }

      // 6. Set cookie & storage secara instan (Zero latency)
      document.cookie = `pilar_employee_session=emp_${uid}; path=/; max-age=604800; SameSite=Lax`;
      document.cookie = `pilar_admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;

      localStorage.setItem("user_email", trimmedEmail);
      localStorage.setItem("pilar_logged_in", "true");
      sessionStorage.setItem("pilar_session_checked", "true");
      sessionStorage.setItem("pilar_cached_employee", JSON.stringify(employeeData));

      // 7. Sinkronisasi sesi server di background (non-blocking)
      try {
        const syncController = new AbortController();
        const syncTimeout = setTimeout(() => syncController.abort(), 2000);
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, role: 'karyawan', uid }),
          signal: syncController.signal,
        });
        clearTimeout(syncTimeout);
      } catch (sessionErr) {
        console.warn("Notice set session cookie:", sessionErr);
      }

      // 8. Masuk ke dashboard karyawan
      window.location.href = "/";
    } catch (err: any) {
      console.error("Login karyawan error:", err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("Email atau kata sandi salah.");
      } else {
        setError("Gagal login: " + ("Terjadi kesalahan."));
      }
      setIsLoading(false);
    }
  };


  return (
    <div className="mobile-container flex flex-col text-pilar-textPrimary mx-auto shadow-2xl relative overflow-hidden bg-pilar-dark">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-20%] w-72 h-72 bg-pilar-gold/10 rounded-full blur-[80px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-20%] w-72 h-72 bg-pilar-gold/5 rounded-full blur-[80px] pointer-events-none"></div>

      <div className="flex-1 flex flex-col justify-center px-8 py-10 z-10 relative">
        
        {/* Logo & Title */}
        <div className="flex flex-col items-center mb-12">
          <div className="w-32 h-32 mb-4 relative group flex items-center justify-center">
            <div className="absolute inset-0 bg-pilar-gold/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <img 
              src="https://res.cloudinary.com/sgcxykbd/image/upload/v1788714730/fwfwfwf.png" 
              alt="Logo PT. PILAR" 
              className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.15)] relative z-10 scale-110 group-hover:scale-105 transition-transform duration-500" 
            />
          </div>
          <h2 className="font-heading font-bold text-2xl text-pilar-textPrimary tracking-wide">Selamat Datang</h2>
          <p className="text-xs text-pilar-textSecondary mt-2 tracking-widest uppercase">Sistem Absensi & HRIS</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-xs font-medium flex items-center shadow-sm">
              <i className="fa-solid fa-circle-exclamation mr-3 text-red-400 text-lg"></i>
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-pilar-textSecondary uppercase tracking-wider pl-1">Email Karyawan</label>
            <div className="relative group">
              <div className="absolute z-10 top-1/2 -translate-y-1/2 left-0 pl-4 flex items-center pointer-events-none">
                <i className={`fa-solid fa-envelope transition-colors ${emailError ? 'text-red-400' : 'text-pilar-textSecondary group-focus-within:text-pilar-gold'}`}></i>
              </div>
              <input
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="nama@pt-pilar.co.id"
                className={`w-full bg-white/5 border rounded-2xl pl-11 pr-4 py-4 text-sm focus:outline-none text-pilar-textPrimary placeholder-pilar-textSecondary/50 transition-all backdrop-blur-sm ${
                  emailError 
                    ? 'border-red-400/50 focus:border-red-400 focus:bg-red-400/5' 
                    : 'border-white/10 focus:border-pilar-gold/50 focus:bg-white/10'
                }`}
              />
            </div>
            {emailError && (
              <p className="text-red-400 text-[10px] ml-1 font-medium flex items-center"><i className="fa-solid fa-asterisk text-[8px] mr-1"></i>{emailError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-pilar-textSecondary uppercase tracking-wider pl-1">Kata Sandi</label>
            <div className="relative group">
              <div className="absolute z-10 top-1/2 -translate-y-1/2 left-0 pl-4 flex items-center pointer-events-none">
                <i className={`fa-solid fa-lock transition-colors ${passwordError ? 'text-red-400' : 'text-pilar-textSecondary group-focus-within:text-pilar-gold'}`}></i>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={handlePasswordChange}
                placeholder="••••••••"
                className={`w-full bg-white/5 border rounded-2xl pl-11 pr-12 py-4 text-sm focus:outline-none text-pilar-textPrimary placeholder-pilar-textSecondary/50 transition-all backdrop-blur-sm ${
                  passwordError 
                    ? 'border-red-400/50 focus:border-red-400 focus:bg-red-400/5' 
                    : 'border-white/10 focus:border-pilar-gold/50 focus:bg-white/10'
                }`}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-1/2 -translate-y-1/2 right-0 pr-4 flex items-center text-pilar-textSecondary hover:text-pilar-textPrimary transition-colors"
              >
                  <i className={`fa-regular ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`}></i>
              </button>
            </div>
            {passwordError && (
              <p className="text-red-400 text-[10px] ml-1 font-medium flex items-center"><i className="fa-solid fa-asterisk text-[8px] mr-1"></i>{passwordError}</p>
            )}
          </div>

          <div className="pt-6">
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-pilar-gold text-pilar-darker font-bold py-4 rounded-2xl shadow-neon hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70 disabled:hover:scale-100 disabled:shadow-none flex items-center justify-center space-x-3 group"
            >
              {isLoading ? (
                <i className="fa-solid fa-spinner fa-spin text-xl"></i>
              ) : (
                <>
                  <span className="text-sm tracking-widest uppercase">Masuk</span>
                  <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 text-center">
          <a href="#" className="text-[11px] font-medium text-pilar-textSecondary hover:text-pilar-gold transition-colors">
            Lupa Kata Sandi? Hubungi HRD
          </a>
        </div>
      </div>
    </div>
  );
}
