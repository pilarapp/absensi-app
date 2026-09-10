"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

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
      await signInWithEmailAndPassword(auth, email, password);
      // Simpan session dummy untuk UI
      localStorage.setItem("user_email", email);
      
      if (email.includes("admin")) {
        router.push("/admin");
      } else {
        router.push("/");
      }
    } catch (err: any) {
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("Email atau kata sandi salah.");
      } else {
        setError("Gagal login: " + err.message);
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
