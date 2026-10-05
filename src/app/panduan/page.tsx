import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Panduan Instalasi - PilarAPP',
};

export default function PanduanPage() {
  return (
    <div className="min-h-screen bg-[#071322] text-gray-200 p-5 font-sans pb-10">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* Navbar / Header */}
        <div className="flex items-center space-x-3 mb-8 pt-4">
          <Link href="/download" className="w-10 h-10 rounded-full bg-[#1e2640] flex items-center justify-center text-white hover:bg-[#252f4a] transition">
            <i className="fa-solid fa-arrow-left"></i>
          </Link>
          <h1 className="text-xl font-bold text-white">Panduan Instalasi</h1>
        </div>

        {/* Android Section */}
        <div className="bg-[#0c1222] border border-[#1e2640] rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2 relative z-10">
            <i className="fa-brands fa-android text-emerald-400 text-2xl"></i>
            <span>Untuk HP Android</span>
          </h2>
          
          <ul className="space-y-4 relative z-10 text-[13px] leading-relaxed text-gray-300">
            <li className="flex items-start space-x-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">1</span>
              <p>Buka link <strong className="text-white">app.pilarsentrasolusi.com/download</strong> menggunakan aplikasi browser <strong className="text-white">Google Chrome</strong> bawaan HP Anda.</p>
            </li>
            <li className="flex items-start space-x-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">2</span>
              <p>Tekan tombol berwarna hitam <strong>"Download untuk Android"</strong> di layar HP Anda.</p>
            </li>
            <li className="flex items-start space-x-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">3</span>
              <p>Akan muncul peringatan pop-up "Install App" atau "Tambahkan ke Layar Utama". Silakan tekan tombol <strong className="text-emerald-400">Install</strong> atau <strong className="text-emerald-400">Tambahkan</strong>.</p>
            </li>
            <li className="flex items-start space-x-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">4</span>
              <p>Tunggu beberapa detik, maka ikon <strong>PilarAPP</strong> akan muncul di layar utama (Home Screen) HP Anda persis seperti aplikasi Play Store!</p>
            </li>
          </ul>
        </div>

        {/* iOS Section */}
        <div className="bg-[#0c1222] border border-[#1e2640] rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-3xl"></div>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2 relative z-10">
            <i className="fa-brands fa-apple text-white text-2xl"></i>
            <span>Untuk iPhone (iOS)</span>
          </h2>
          
          <ul className="space-y-4 relative z-10 text-[13px] leading-relaxed text-gray-300">
            <li className="flex items-start space-x-3">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0">1</span>
              <p>Wajib menggunakan browser <strong className="text-white">Safari</strong> bawaan iPhone. Buka link <strong className="text-white">app.pilarsentrasolusi.com/download</strong>.</p>
            </li>
            <li className="flex items-start space-x-3">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0">2</span>
              <p>Di bar bagian tengah-bawah layar Safari, cari dan ketuk tombol <strong>Share</strong> <i className="fa-solid fa-arrow-up-from-bracket mx-1 text-white"></i> (Ikon kotak dengan panah mengarah ke atas).</p>
            </li>
            <li className="flex items-start space-x-3">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0">3</span>
              <p>Gulir menu yang muncul ke bawah, lalu cari dan ketuk menu <strong className="text-blue-400">Add to Home Screen</strong> (Tambahkan ke Layar Utama).</p>
            </li>
            <li className="flex items-start space-x-3">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0">4</span>
              <p>Ketuk tulisan <strong>Add (Tambah)</strong> di sudut kanan atas layar. Ikon <strong>PilarAPP</strong> akan langsung masuk ke layar utama iPhone Anda!</p>
            </li>
          </ul>
        </div>

        <div className="text-center pt-4 pb-12">
          <Link href="/download" className="inline-block px-8 py-3.5 bg-[#4355f9] text-white rounded-xl font-bold text-sm shadow-lg shadow-[#4355f9]/20 hover:bg-blue-600 transition">
            Kembali ke Halaman Download
          </Link>
        </div>

      </div>
    </div>
  );
}
