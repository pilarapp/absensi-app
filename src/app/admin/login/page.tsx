"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AdminLoginPage() {
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
      // Simpan session admin (bisa diganti JWT jika menggunakan Middleware backend)
      localStorage.setItem("admin_email", email);
      
      if (email.includes("admin")) {
        router.push("/admin");
      } else {
        // Logout langsung jika bukan admin
        await auth.signOut();
        setError("Kredensial Admin tidak valid.");
        setIsLoading(false);
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
    <div className="min-h-screen w-full bg-pilar-darker flex items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* Decorative Background Elements (Blue Gradients) */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600/30 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] bg-blue-800/40 rounded-full blur-[120px]"></div>
      <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] bg-blue-400/20 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[20%] left-[10%] w-[500px] h-[500px] bg-indigo-600/30 rounded-full blur-[100px]"></div>
      <div className="absolute top-[40%] left-[40%] w-[800px] h-[800px] bg-blue-900/50 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Split Login Card Layout */}
      <div className="relative z-10 flex flex-col md:flex-row bg-white w-full max-w-[750px] rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Left Side: Form */}
        <div className="w-full md:w-1/2 p-8 lg:p-10 flex flex-col justify-center relative z-20">


            <div className="text-center mb-8 px-2 mt-4">
                <h2 className="text-[22px] lg:text-[26px] font-extrabold text-gray-900 tracking-tight mb-2">Selamat Datang</h2>
                <p className="text-xs lg:text-sm font-medium text-gray-500">Masuk menggunakan email Anda.</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4 w-full max-w-[320px] mx-auto">
              {error && (
                <div className="bg-red-50 text-red-500 text-xs p-3 rounded-xl border border-red-100 text-center">
                  {error}
                </div>
              )}

                {/* Username / Email */}
                <div className="relative">
                    <input 
                      type="email" 
                      value={email}
                      onChange={handleEmailChange}
                      className={`w-full px-5 py-3.5 bg-gray-50 border rounded-lg outline-none transition-all font-medium text-sm placeholder-gray-400 ${
                        emailError 
                          ? 'border-red-400 text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' 
                          : 'border-gray-200 text-gray-900 focus:border-pilar-gold focus:ring-2 focus:ring-pilar-gold/20'
                      }`} 
                      placeholder="Email Admin" 
                    />
                    {emailError && (
                      <p className="text-red-500 text-[10px] mt-1.5 font-medium ml-1">{emailError}</p>
                    )}
                </div>
                
                {/* Password */}
                <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={password}
                      onChange={handlePasswordChange}
                      className={`w-full px-5 py-3.5 bg-gray-50 border rounded-lg outline-none transition-all font-medium text-sm placeholder-gray-400 ${
                        passwordError 
                          ? 'border-red-400 text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' 
                          : 'border-gray-200 text-gray-900 focus:border-pilar-gold focus:ring-2 focus:ring-pilar-gold/20'
                      }`} 
                      placeholder="Kata Sandi" 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-3.5 right-0 pr-5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <i className={`fa-regular ${showPassword ? 'fa-eye' : 'fa-eye-slash'} text-sm`}></i>
                    </button>
                    {passwordError && (
                      <p className="text-red-500 text-[10px] mt-1.5 font-medium ml-1">{passwordError}</p>
                    )}
                </div>



                {/* Button */}
                <div className="pt-4 mb-2">
                    <button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full py-3.5 bg-pilar-darker hover:bg-gray-900 text-white font-bold text-sm rounded-lg transition-all shadow-md tracking-wide disabled:opacity-70 flex justify-center items-center"
                    >
                      {isLoading ? (
                        <i className="fa-solid fa-spinner fa-spin"></i>
                      ) : (
                        <span>Masuk</span>
                      )}
                    </button>
                </div>
            </form>
        </div>

        {/* Right Side: Image */}
        <div className="hidden md:block w-full md:w-1/2 p-2 relative z-10 group overflow-hidden">
            <div className="w-full h-full min-h-[450px] rounded-xl overflow-hidden relative">
                {/* Beautiful Image */}
                <img src="https://res-console.cloudinary.com/sgcxykbd/thumbnails/v1/image/upload/v1788738455/TG9nb19Db3Zlcg==/drilldown" alt="Illustration" className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                
                {/* Soft gradient overlay for better blending */}
                <div className="absolute inset-0 bg-gradient-to-tr from-pilar-darker/20 to-transparent pointer-events-none z-10"></div>
                
                {/* Shine Animation overlay */}
                <div className="absolute top-0 -inset-full h-full w-1/2 z-20 block transform -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-20 pointer-events-none animate-shine"></div>
            </div>
        </div>

      </div>
    </div>
  );
}
