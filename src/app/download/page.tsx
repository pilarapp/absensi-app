"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

export default function DownloadPwaPage() {
  const [device, setDevice] = useState<"android" | "ios" | "desktop">("android");
  const [activeTab, setActiveTab] = useState<"android" | "ios">("android");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showInAppWarning, setShowInAppWarning] = useState(false);

  useEffect(() => {
    // 1. Deteksi Sistem Operasi Pengguna
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || "";
    const isIos = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    const isAndroid = /android/i.test(userAgent);

    if (isIos) {
      setDevice("ios");
      setActiveTab("ios");
    } else if (isAndroid) {
      setDevice("android");
      setActiveTab("android");
    } else {
      setDevice("desktop");
      setActiveTab("android");
    }

    // 2. Deteksi apakah dibuka di In-App Browser (WhatsApp, Instagram, FB)
    const isInApp = /FBAN|FBAV|Instagram|Line|WhatsApp/i.test(userAgent);
    if (isInApp) {
      setShowInAppWarning(true);
    }

    // 3. Deteksi apakah aplikasi sudah terinstal (Standalone Mode)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
    if (isStandalone) {
      setIsInstalled(true);
    }

    // 4. Tangkap Event PWA Install Prompt untuk Android/Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallAndroid = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      setIsInstallable(false);
    } else {
      alert(
        "Cara Pasang di Android:\n\n1. Buka browser Chrome.\n2. Tekan menu titik tiga (⋮) di pojok kanan atas.\n3. Pilih 'Instal aplikasi' atau 'Tambahkan ke Layar Utama'."
      );
    }
  };

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="mobile-container flex flex-col items-center justify-center min-h-screen text-pilar-textPrimary mx-auto relative overflow-hidden bg-[#4355f9]">
      
      {/* Decorative Blur Effect (optional for depth) */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>

      {/* Header section (Outside Card) */}
      <div className="flex flex-col items-center justify-center w-[85%] max-w-[320px] mb-8 relative z-10 text-center">
        <div className="w-20 h-20 bg-[#4355f9] rounded-2xl shadow-lg shrink-0 flex items-center justify-center overflow-hidden border border-white/10">
          <img src="/icon-512.png" alt="Icon" className="w-full h-full object-cover opacity-90" />
        </div>
        <div className="mt-4 flex flex-col items-center justify-center">
          <h1 className="text-white font-bold text-xl tracking-wide leading-tight">PilarAPP</h1>
          <p className="text-gray-200 text-xs mt-1">PT. Pilar Sentra Solusi</p>
        </div>
      </div>

      {/* Card container */}
      <div className="w-[85%] max-w-[320px] bg-[#0c1222] rounded-2xl shadow-2xl relative z-10 font-sans border border-[#1e2640]">
        
        {/* Body Section */}
        <div className="p-5 flex flex-col space-y-4">
          


          {/* Apple Button */}
          <button 
            onClick={() => {
              if (device === "ios") {
                alert("Cara Pasang di iOS:\n1. Buka halaman ini di browser Safari.\n2. Tekan tombol Share (ikon panah ke atas) di bawah.\n3. Pilih 'Add to Home Screen' atau 'Tambahkan ke Layar Utama'.");
              } else {
                alert("Fitur ini khusus iPhone/iPad. Silakan gunakan tombol Google Play untuk HP Android Anda.");
              }
            }} 
            className="w-full bg-black border border-[#252f4a] rounded-xl p-3 flex items-center justify-center space-x-3 hover:bg-gray-900 transition active:scale-[0.98]"
          >
            <i className="fa-brands fa-apple text-white text-3xl"></i>
            <div className="text-left flex flex-col justify-center">
              <span className="text-gray-200 text-[10px] leading-none mb-1">Download</span>
              <span className="text-white text-xl font-semibold leading-none tracking-tight">untuk iOS</span>
            </div>
          </button>

          {/* Google Play Button */}
          <button 
            onClick={() => {
              if (device === "android" || device === "desktop") {
                 handleInstallAndroid();
              } else {
                 alert("Fitur ini khusus Android. Silakan gunakan tombol App Store untuk iPhone Anda.");
              }
            }} 
            className="w-full bg-black border border-[#252f4a] rounded-xl p-3 flex items-center justify-center space-x-3 hover:bg-gray-900 transition active:scale-[0.98]"
          >
            {/* Google Play Logo dari Cloudinary */}
            <img 
              src="https://res.cloudinary.com/sgcxykbd/image/upload/v1791194185/CITYPNG.COM_HD_Google_Play_PlayStore_Logo_Symbol_PNG_-_3000x3000.png" 
              alt="Google Play" 
              className="w-7 h-7 object-contain"
            />
            <div className="text-left flex flex-col justify-center">
              <span className="text-gray-200 text-[10px] uppercase font-medium leading-none mb-1">Download</span>
              <span className="text-white text-xl font-semibold leading-none tracking-tight">untuk Android</span>
            </div>
          </button>
             
          {/* Text Link Buka Web & Panduan */}
          <div className="pt-2 flex flex-col items-center space-y-3">
            <Link href="/panduan" className="text-blue-400 font-medium text-[11px] hover:text-blue-300 underline transition">
              Baca Panduan Instal Lengkap
            </Link>
            <Link href="/" className="text-gray-500 text-[11px] hover:text-white underline transition">
              Abaikan dan langsung buka aplikasi
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
