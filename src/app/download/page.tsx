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
    <div className="mobile-container flex flex-col text-pilar-textPrimary mx-auto shadow-2xl relative overflow-hidden bg-pilar-dark">
      
      {/* Decorative Glow */}
      <div className="absolute top-[-10%] left-[-20%] w-60 h-60 bg-pilar-gold/10 rounded-full blur-[70px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-20%] w-60 h-60 bg-blue-600/10 rounded-full blur-[70px] pointer-events-none"></div>

      {/* Header Mobile */}
      <header className="pt-7 pb-5 px-5 bg-pilar-darker rounded-b-3xl shadow-md z-10 relative text-center border-b border-white/5">
        <span className="inline-flex items-center px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-pilar-gold/15 text-pilar-gold border border-pilar-gold/30 mb-2 shadow-sm">
          <i className="fa-solid fa-shield-halved mr-1 text-[9px]"></i> Aplikasi Karyawan Resmi
        </span>

        <div className="flex items-center justify-center space-x-3 mt-1">
          <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg border border-pilar-gold/40 shrink-0 bg-pilar-darker">
            <img src="/icon-512.png" alt="PilarAPP" className="w-full h-full object-cover" />
          </div>
          <div className="text-left">
            <h1 className="text-xl font-black text-white tracking-tight leading-none">
              Pilar<span className="text-pilar-gold">APP</span>
            </h1>
            <p className="text-[11px] text-gray-400 font-medium mt-1">PT. Pilar Sentra Solusi</p>
          </div>
        </div>
      </header>

      {/* Main Scrollable Body */}
      <main className="flex-1 overflow-y-auto scrollable-content px-5 pt-4 pb-6 space-y-4 animate-slide-up relative z-10">
        
        {/* Warning jika di In-App Browser (WhatsApp/IG) */}
        {showInAppWarning && (
          <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-start space-x-2.5 shadow-sm">
            <i className="fa-solid fa-triangle-exclamation text-amber-400 text-sm mt-0.5 shrink-0"></i>
            <div>
              <p className="font-bold text-amber-300">Buka di Browser Utama</p>
              <p className="mt-0.5 text-gray-300 text-[11px] leading-relaxed">
                Tekan tombol titik tiga <strong>(⋮)</strong> di atas lalu pilih <strong>Buka di Chrome / Safari</strong> agar dapat dipasang ke layar HP.
              </p>
            </div>
          </div>
        )}

        {/* Notifikasi jika sudah terpasang */}
        {isInstalled && (
          <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-2">
              <i className="fa-solid fa-circle-check text-emerald-400 text-base"></i>
              <span className="font-bold text-white text-[11px]">PilarAPP Sudah Terpasang!</span>
            </div>
            <Link 
              href="/" 
              className="px-3 py-1 bg-emerald-500 text-emerald-950 font-extrabold rounded-lg text-xs hover:bg-emerald-400 transition shadow-sm"
            >
              Buka App
            </Link>
          </div>
        )}

        {/* OS Tab Selector */}
        <div className="bg-pilar-darker/90 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 flex items-center shadow-inner">
          <button
            onClick={() => setActiveTab("android")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === "android"
                ? "bg-pilar-gold text-pilar-darker shadow-md font-extrabold scale-[1.02]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <i className="fa-brands fa-android text-sm"></i>
            <span>Android</span>
            {device === "android" && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-pilar-darker/20 text-pilar-darker uppercase font-black">HP Anda</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("ios")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === "ios"
                ? "bg-pilar-gold text-pilar-darker shadow-md font-extrabold scale-[1.02]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <i className="fa-brands fa-apple text-sm"></i>
            <span>iPhone (iOS)</span>
            {device === "ios" && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-pilar-darker/20 text-pilar-darker uppercase font-black">HP Anda</span>
            )}
          </button>
        </div>

        {/* TAB KONTEN 1: ANDROID */}
        {activeTab === "android" && (
          <div className="space-y-3 animate-fade-in">
            <div className="bg-pilar-darker/70 backdrop-blur-sm border border-white/10 rounded-2xl p-4 shadow-lg space-y-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-base font-bold">
                  <i className="fa-brands fa-android"></i>
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">Pasang di HP Android</h3>
                  <p className="text-[11px] text-gray-400">Chrome, Samsung Internet, Edge</p>
                </div>
              </div>

              {/* Tombol Pasang Utama */}
              <button
                onClick={handleInstallAndroid}
                className="w-full py-3.5 px-4 rounded-xl bg-pilar-gold hover:bg-amber-400 active:scale-[0.98] text-pilar-darker font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center space-x-2"
              >
                <i className="fa-solid fa-download text-sm"></i>
                <span>{isInstallable ? "PASANG SEKARANG DI ANDROID" : "DOWNLOAD / PASANG PILARAPP"}</span>
              </button>

              {/* Langkah Manual Android */}
              <div className="bg-black/40 rounded-xl p-3 border border-white/5 space-y-2 text-[11px] text-gray-300">
                <p className="font-bold text-pilar-gold flex items-center text-xs">
                  <i className="fa-solid fa-circle-info mr-1.5"></i>
                  Cara Pemasangan di Android:
                </p>
                <div className="flex items-start space-x-2">
                  <span className="w-4 h-4 rounded-full bg-white/10 text-white flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">1</span>
                  <span>Buka halaman ini di browser <strong>Google Chrome</strong>.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="w-4 h-4 rounded-full bg-white/10 text-white flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">2</span>
                  <span>Tekan menu titik tiga <strong>(⋮)</strong> di pojok kanan atas browser.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="w-4 h-4 rounded-full bg-white/10 text-white flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">3</span>
                  <span>Pilih <strong className="text-pilar-gold">"Instal aplikasi"</strong> atau <strong className="text-pilar-gold">"Tambahkan ke Layar Utama"</strong>.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB KONTEN 2: IOS (IPHONE) */}
        {activeTab === "ios" && (
          <div className="space-y-3 animate-fade-in">
            <div className="bg-pilar-darker/70 backdrop-blur-sm border border-white/10 rounded-2xl p-4 shadow-lg space-y-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center text-base font-bold">
                  <i className="fa-brands fa-apple"></i>
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">Pasang di iPhone / iPad</h3>
                  <p className="text-[11px] text-gray-400">Gunakan browser bawaan Safari</p>
                </div>
              </div>

              {/* 4 Langkah iOS */}
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center space-x-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-xs shrink-0">1</span>
                  <p className="text-[11px] text-gray-300">Buka link ini di browser <strong className="text-white">Safari</strong>.</p>
                </div>

                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center space-x-3">
                  <span className="w-6 h-6 rounded-full bg-pilar-gold/20 text-pilar-gold flex items-center justify-center font-black text-xs shrink-0">2</span>
                  <p className="text-[11px] text-gray-300">
                    Tekan tombol <strong className="text-white">Share</strong>{" "}
                    <span className="inline-flex items-center px-1.5 py-0.5 bg-white/10 rounded text-blue-400 font-bold mx-0.5">
                      <i className="fa-solid fa-arrow-up-from-bracket text-xs"></i>
                    </span>{" "}
                    di bar bawah Safari.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center space-x-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xs shrink-0">3</span>
                  <p className="text-[11px] text-gray-300">
                    Gulir ke bawah dan pilih <strong className="text-pilar-gold">"Tambahkan ke Layar Utama"</strong> (➕).
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center space-x-3">
                  <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-black text-xs shrink-0">4</span>
                  <p className="text-[11px] text-gray-300">
                    Tekan <strong className="text-white">"Tambah"</strong> di pojok kanan atas. Ikon PilarAPP langsung muncul di HP!
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                <p className="text-[10px] text-blue-300">
                  <i className="fa-solid fa-shield-heart mr-1"></i> Terpasang di Layar Utama iPhone persis seperti aplikasi App Store.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tombol Alternatif & Share */}
        <div className="space-y-2 pt-1">
          <Link
            href="/"
            className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] border border-white/15 text-white font-bold text-xs transition-all flex items-center justify-center space-x-2 shadow-sm"
          >
            <i className="fa-solid fa-arrow-right-to-bracket text-pilar-gold"></i>
            <span>Buka Versi Web (Tanpa Pasang)</span>
          </Link>

          <button
            onClick={handleCopyLink}
            className="w-full py-2.5 px-4 rounded-xl text-gray-400 hover:text-white text-xs transition flex items-center justify-center space-x-2"
          >
            <i className={copied ? "fa-solid fa-check text-emerald-400" : "fa-solid fa-share-nodes"}></i>
            <span>{copied ? "Link Berhasil Disalin!" : "Salin Link untuk Dibagikan ke Karyawan"}</span>
          </button>
        </div>

        {/* Fitur Singkat */}
        <div className="pt-3 border-t border-white/10 grid grid-cols-3 gap-2 text-center text-gray-400">
          <div className="p-2 rounded-xl bg-pilar-darker/50 border border-white/5">
            <i className="fa-solid fa-bolt text-pilar-gold text-sm mb-1 block"></i>
            <p className="font-bold text-[11px] text-white">Ringan</p>
            <p className="text-[9px] text-gray-400">&lt; 2 MB</p>
          </div>
          <div className="p-2 rounded-xl bg-pilar-darker/50 border border-white/5">
            <i className="fa-solid fa-location-dot text-pilar-gold text-sm mb-1 block"></i>
            <p className="font-bold text-[11px] text-white">GPS Presisi</p>
            <p className="text-[9px] text-gray-400">Anti Fake GPS</p>
          </div>
          <div className="p-2 rounded-xl bg-pilar-darker/50 border border-white/5">
            <i className="fa-solid fa-file-invoice-dollar text-pilar-gold text-sm mb-1 block"></i>
            <p className="font-bold text-[11px] text-white">Slip Gaji</p>
            <p className="text-[9px] text-gray-400">Realtime</p>
          </div>
        </div>

      </main>

      {/* Footer Ringkas */}
      <footer className="py-2.5 text-center text-[10px] text-gray-400 bg-pilar-darker/80 border-t border-white/5 shrink-0">
        &copy; {new Date().getFullYear()} PT. Pilar Sentra Solusi
      </footer>
    </div>
  );
}
