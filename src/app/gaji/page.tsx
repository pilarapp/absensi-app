"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NotificationBell from "@/components/NotificationBell";
import { subscribeToSalaries } from "@/lib/db";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

type SlipGaji = {
  id: string;
  karyawanId: string;
  nama: string;
  tanggal: string;
  gajiPokok: number;
  potongan: number;
  potonganAlpa?: number;
  potonganBpjsTk?: number;
  potonganBpjsKes?: number;
  bpjsTkRate?: number;
  bpjsKesRate?: number;
  alpa: number;
  gajiBersih: number;
  createdAt?: string;
};

export default function GajiPage() {
  const [riwayat, setRiwayat] = useState<SlipGaji[]>([]);
  const [selectedSlip, setSelectedSlip] = useState<SlipGaji | null>(null);

  useEffect(() => {
    let unsubscribeSalaries: any;
    
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsubscribeSalaries = subscribeToSalaries(user.uid, (data) => {
          if (data && data.length > 0) {
            data.sort((a, b) => new Date(b.createdAt || b.tanggal).getTime() - new Date(a.createdAt || a.tanggal).getTime());
            setRiwayat(data as any);
          } else {
            // Fallback ke localStorage jika belum tersinkron
            try {
              const savedGaji = localStorage.getItem("pilar_gaji_karyawan");
              if (savedGaji) {
                const localData = JSON.parse(savedGaji);
                const userSlips = localData.filter((s: any) => s.karyawanId === user.uid || !s.karyawanId);
                setRiwayat(userSlips);
              } else {
                setRiwayat([]);
              }
            } catch {
              setRiwayat([]);
            }
          }
        });
      } else {
        setRiwayat([]);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSalaries) unsubscribeSalaries();
    };
  }, []);

  return (
    <>
      <div className="mobile-container flex flex-col text-pilar-textPrimary mx-auto shadow-2xl print:hidden">
      {/* Header */}
      <header className="pt-10 pb-6 px-6 bg-pilar-darker rounded-b-3xl shadow-md z-10 relative">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold font-heading text-pilar-textPrimary">
              Slip Gaji
            </h1>
            <h2 className="text-xs text-pilar-textSecondary tracking-wider">
              Riwayat Pendapatan Anda
            </h2>
          </div>
          <div className="flex items-center space-x-3">
            <NotificationBell />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto scrollable-content px-6 py-6 pb-24 relative animate-slide-up">
        {riwayat.length > 0 ? (
          <div className="space-y-4">
            {riwayat.map((slip) => (
              <div key={slip.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 relative overflow-hidden backdrop-blur-sm shadow-xl">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-pilar-gold/5 rounded-full blur-2xl"></div>
                
                <div className="flex justify-between items-start mb-4 border-b border-white/10 pb-3 relative z-10">
                  <div>
                    <span className="text-[10px] text-pilar-textSecondary uppercase tracking-widest block mb-1">Tanggal Cair</span>
                    <span className="font-bold text-sm text-white">{slip.tanggal}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-green-400 uppercase tracking-widest block mb-1 font-bold">Berhasil</span>
                    <span className="font-mono text-[10px] text-pilar-textSecondary">{slip.id}</span>
                  </div>
                </div>

                <div className="bg-black/20 rounded-xl p-4 flex justify-between items-center border border-white/5 shadow-inner relative z-10 my-3">
                  <span className="text-xs text-pilar-gold font-bold uppercase tracking-wider">Total Diterima</span>
                  <span className="text-lg font-bold text-green-400">Rp {new Intl.NumberFormat('id-ID').format(slip.gajiBersih)}</span>
                </div>

                {/* Tombol Lihat Slip Gaji */}
                <button
                  type="button"
                  onClick={() => setSelectedSlip(slip)}
                  className="w-full mt-3 py-2.5 px-4 rounded-xl bg-pilar-gold/15 hover:bg-pilar-gold text-pilar-gold hover:text-pilar-darker border border-pilar-gold/30 font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-sm group relative z-10"
                >
                  <i className="fa-solid fa-file-invoice group-hover:scale-110 transition-transform"></i>
                  <span>Lihat Slip Gaji</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white/5 rounded-2xl border border-dashed border-white/10 mt-10">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-wallet text-3xl text-pilar-textSecondary"></i>
            </div>
            <p className="text-sm font-bold text-white mb-1">Belum ada riwayat gaji.</p>
            <p className="text-xs text-pilar-textSecondary">Gaji Anda bulan ini belum dicairkan oleh HRD.</p>
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
        <Link href="/pengajuan" className="flex flex-col items-center text-pilar-textSecondary hover:text-pilar-textPrimary transition-colors">
          <i className="fa-solid fa-file-invoice text-xl mb-1"></i>
          <span className="text-[10px] font-medium">Pengajuan</span>
        </Link>
        <Link href="/gaji" className="flex flex-col items-center text-pilar-gold">
          <i className="fa-solid fa-sack-dollar text-xl mb-1"></i>
          <span className="text-[10px] font-medium">Gaji</span>
        </Link>
        <Link href="/pengaturan" className="flex flex-col items-center text-pilar-textSecondary hover:text-pilar-textPrimary transition-colors">
          <i className="fa-solid fa-cog text-xl mb-1"></i>
          <span className="text-[10px] font-medium">Pengaturan</span>
        </Link>
      </nav>

      {/* MODAL SLIP GAJI RESMI (ON SCREEN) */}
      {selectedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 print:hidden">
          <div className="bg-white text-gray-800 rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100">
            {/* Header Slip (Formal Company Pay Stub Style) */}
            <div className="bg-pilar-darker text-white p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-pilar-gold/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
              
              <div className="flex justify-between items-start relative z-10">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                    <i className="fa-solid fa-building text-pilar-gold text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm tracking-wide text-white">PT. PILAR SENTRA SOLUSI</h3>
                    <p className="text-[10px] text-gray-300">Slip Gaji Karyawan Resmi</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setSelectedSlip(null)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors"
                >
                  <i className="fa-solid fa-xmark text-sm"></i>
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-end relative z-10 text-xs">
                <div>
                  <span className="text-[10px] text-gray-400 block">Nomor Slip:</span>
                  <span className="font-mono font-bold text-pilar-gold text-[11px]">{selectedSlip.id}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 block">Tanggal Cair:</span>
                  <span className="font-bold text-white text-[11px]">{selectedSlip.tanggal}</span>
                </div>
              </div>
            </div>

            {/* Slip Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Employee Info */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Nama Karyawan</span>
                  <span className="font-extrabold text-gray-800 text-sm">{selectedSlip.nama}</span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Lunas
                </span>
              </div>

              {/* Rincian Penerimaan */}
              <div>
                <div className="flex items-center space-x-1.5 mb-2 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                  <i className="fa-solid fa-circle-plus text-emerald-500"></i>
                  <span>Penghasilan (Earnings)</span>
                </div>
                <div className="space-y-1.5 bg-gray-50/50 rounded-xl p-3 border border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Gaji Pokok</span>
                    <span className="font-bold text-gray-800">Rp {new Intl.NumberFormat('id-ID').format(selectedSlip.gajiPokok)}</span>
                  </div>
                </div>
              </div>

              {/* Rincian Pemotongan */}
              <div>
                <div className="flex items-center space-x-1.5 mb-2 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                  <i className="fa-solid fa-circle-minus text-red-500"></i>
                  <span>Potongan (Deductions)</span>
                </div>
                <div className="space-y-2 bg-gray-50/50 rounded-xl p-3 border border-gray-100 text-xs">
                  {/* Potongan Alpa */}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Potongan Alpa ({selectedSlip.alpa || 0} Hari)</span>
                    <span className={(selectedSlip.potonganAlpa || 0) > 0 ? "font-bold text-red-600" : "font-medium text-gray-400"}>
                      {(selectedSlip.potonganAlpa || 0) > 0 
                        ? `- Rp ${new Intl.NumberFormat('id-ID').format(selectedSlip.potonganAlpa!)}` 
                        : "Rp 0"}
                    </span>
                  </div>

                  {/* BPJS Ketenagakerjaan */}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">BPJS Ketenagakerjaan ({selectedSlip.bpjsTkRate ?? 2}%)</span>
                    <span className={(selectedSlip.potonganBpjsTk || 0) > 0 ? "font-bold text-red-600" : "font-medium text-gray-400"}>
                      {(selectedSlip.potonganBpjsTk || 0) > 0 
                        ? `- Rp ${new Intl.NumberFormat('id-ID').format(selectedSlip.potonganBpjsTk!)}` 
                        : "Rp 0"}
                    </span>
                  </div>

                  {/* BPJS Kesehatan */}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">BPJS Kesehatan ({selectedSlip.bpjsKesRate ?? 1}%)</span>
                    <span className={(selectedSlip.potonganBpjsKes || 0) > 0 ? "font-bold text-red-600" : "font-medium text-gray-400"}>
                      {(selectedSlip.potonganBpjsKes || 0) > 0 
                        ? `- Rp ${new Intl.NumberFormat('id-ID').format(selectedSlip.potonganBpjsKes!)}` 
                        : "Rp 0"}
                    </span>
                  </div>

                  {/* Total Potongan */}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200/80 font-bold">
                    <span className="text-gray-700">Total Potongan</span>
                    <span className={(selectedSlip.potongan || 0) > 0 ? "text-red-600" : "text-gray-500"}>
                      {(selectedSlip.potongan || 0) > 0 
                        ? `- Rp ${new Intl.NumberFormat('id-ID').format(selectedSlip.potongan)}` 
                        : "Rp 0"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Gaji Bersih */}
              <div className="p-4 rounded-2xl bg-pilar-darker text-white flex justify-between items-center shadow-lg">
                <div>
                  <span className="text-[10px] text-pilar-gold font-bold uppercase tracking-wider block">Gaji Bersih (Take Home Pay)</span>
                  <span className="text-lg font-black text-white">
                    Rp {new Intl.NumberFormat('id-ID').format(selectedSlip.gajiBersih)}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-pilar-gold text-lg">
                  <i className="fa-solid fa-check-double"></i>
                </div>
              </div>

              {/* Catatan Legal */}
              <div className="text-center pt-2 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 italic">
                  Dokumen ini diterbitkan secara sah oleh Sistem Penggajian PT. Pilar Sentra Solusi.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex space-x-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-4 bg-pilar-darker hover:bg-black text-pilar-gold rounded-xl font-bold text-xs flex items-center justify-center space-x-2 shadow-sm transition-all"
              >
                <i className="fa-solid fa-print"></i>
                <span>Cetak / Simpan</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedSlip(null)}
                className="py-2.5 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold text-xs transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* DOKUMEN CETAK SLIP GAJI RESMI (HANYA MUNCUL SAAT PRINT / SIMPAN PDF) */}
    {selectedSlip && (
      <div 
        id="print-section" 
        className="hidden print:block text-black font-sans p-8 md:p-12 bg-white w-full min-h-screen" 
        style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
      >
        {/* KOP SURAT PERUSAHAAN */}
        <div className="flex items-center justify-between border-b-2 border-pilar-darker pb-4 mb-6">
          <div className="flex items-center space-x-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="https://res.cloudinary.com/sgcxykbd/image/upload/v1788834500/logo_horizontal_2.png" 
              alt="Logo PT. Pilar Sentra Solusi" 
              className="h-14 object-contain" 
            />
          </div>
          <div className="text-right">
            <h1 className="text-xl font-black tracking-tight text-pilar-darker uppercase">PT. PILAR SENTRA SOLUSI</h1>
            <p className="text-xs text-gray-600 font-semibold">General Contractor & IT Solutions</p>
            <p className="text-[11px] text-gray-500">Grand Slipi Tower Lt. 9, Jakarta Barat 11480 | info@pilarsentrasolusi.com</p>
          </div>
        </div>

        {/* JUDUL SLIP GAJI */}
        <div className="text-center my-6">
          <h2 className="text-lg font-black uppercase tracking-wider text-pilar-darker border-b-2 border-pilar-gold inline-block pb-1">
            SLIP GAJI KARYAWAN (CONFIDENTIAL PAYSLIP)
          </h2>
          <p className="text-xs text-gray-500 mt-1">Bukti Resmi Pembayaran Gaji Karyawan</p>
        </div>

        {/* METADATA KARYAWAN & TRANSAKSI */}
        <div className="grid grid-cols-2 gap-4 mb-6 p-4 rounded-xl border border-gray-300 bg-gray-50/70 text-xs">
          <div className="space-y-2">
            <div className="grid grid-cols-[120px_auto_1fr] gap-2">
              <span className="text-gray-600 font-medium">Nama Karyawan</span>
              <span className="text-gray-400">:</span>
              <span className="font-bold text-gray-900 uppercase">{selectedSlip.nama}</span>
            </div>
            <div className="grid grid-cols-[120px_auto_1fr] gap-2">
              <span className="text-gray-600 font-medium">Nomor Slip</span>
              <span className="text-gray-400">:</span>
              <span className="font-mono font-bold text-gray-800">{selectedSlip.id}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-[120px_auto_1fr] gap-2">
              <span className="text-gray-600 font-medium">Tanggal Pencairan</span>
              <span className="text-gray-400">:</span>
              <span className="font-bold text-gray-900">{selectedSlip.tanggal}</span>
            </div>
            <div className="grid grid-cols-[120px_auto_1fr] gap-2">
              <span className="text-gray-600 font-medium">Status Pembayaran</span>
              <span className="text-gray-400">:</span>
              <span className="font-extrabold text-emerald-700">LUNAS / BERHASIL DITRANSFER</span>
            </div>
          </div>
        </div>

        {/* TABEL PENGHASILAN & POTONGAN */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Kolom Kiri: Penghasilan */}
          <div className="border border-gray-300 rounded-xl overflow-hidden">
            <div className="bg-pilar-darker text-pilar-gold font-bold px-4 py-2.5 text-xs uppercase tracking-wider flex justify-between items-center">
              <span>A. Penghasilan (Earnings)</span>
              <i className="fa-solid fa-circle-plus text-xs"></i>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-gray-200">
                <span className="text-gray-700">Gaji Pokok</span>
                <span className="font-bold text-gray-900">
                  Rp {new Intl.NumberFormat('id-ID').format(selectedSlip.gajiPokok || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-100 text-gray-400">
                <span>Tunjangan Operasional</span>
                <span>Rp 0</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-300 font-extrabold text-gray-900 text-sm">
                <span>Total Penghasilan (A)</span>
                <span className="text-pilar-darker">
                  Rp {new Intl.NumberFormat('id-ID').format(selectedSlip.gajiPokok || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Potongan */}
          <div className="border border-gray-300 rounded-xl overflow-hidden">
            <div className="bg-pilar-darker text-pilar-gold font-bold px-4 py-2.5 text-xs uppercase tracking-wider flex justify-between items-center">
              <span>B. Potongan (Deductions)</span>
              <i className="fa-solid fa-circle-minus text-xs"></i>
            </div>
            <div className="p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-gray-100">
                <span className="text-gray-700">Potongan Alpa ({selectedSlip.alpa || 0} Hari)</span>
                <span className={(selectedSlip.potonganAlpa || 0) > 0 ? "font-bold text-red-600" : "text-gray-500"}>
                  {(selectedSlip.potonganAlpa || 0) > 0 
                    ? `- Rp ${new Intl.NumberFormat('id-ID').format(selectedSlip.potonganAlpa!)}` 
                    : "Rp 0"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-100">
                <span className="text-gray-700">BPJS Ketenagakerjaan ({selectedSlip.bpjsTkRate ?? 2}%)</span>
                <span className={(selectedSlip.potonganBpjsTk || 0) > 0 ? "font-bold text-red-600" : "text-gray-500"}>
                  {(selectedSlip.potonganBpjsTk || 0) > 0 
                    ? `- Rp ${new Intl.NumberFormat('id-ID').format(selectedSlip.potonganBpjsTk!)}` 
                    : "Rp 0"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-100">
                <span className="text-gray-700">BPJS Kesehatan ({selectedSlip.bpjsKesRate ?? 1}%)</span>
                <span className={(selectedSlip.potonganBpjsKes || 0) > 0 ? "font-bold text-red-600" : "text-gray-500"}>
                  {(selectedSlip.potonganBpjsKes || 0) > 0 
                    ? `- Rp ${new Intl.NumberFormat('id-ID').format(selectedSlip.potonganBpjsKes!)}` 
                    : "Rp 0"}
                </span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-300 font-extrabold text-red-600 text-sm">
                <span className="text-gray-800">Total Potongan (B)</span>
                <span>
                  {(selectedSlip.potongan || 0) > 0 
                    ? `- Rp ${new Intl.NumberFormat('id-ID').format(selectedSlip.potongan)}` 
                    : "Rp 0"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* HIGHLIGHT BOX: TAKE HOME PAY */}
        <div className="border-2 border-pilar-darker rounded-2xl p-5 bg-gray-50 flex justify-between items-center mb-8 shadow-sm">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
              Gaji Bersih Diterima (Take Home Pay = A - B)
            </span>
            <span className="text-2xl font-black text-pilar-darker tracking-tight">
              Rp {new Intl.NumberFormat('id-ID').format(selectedSlip.gajiBersih || 0)}
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
        <div className="grid grid-cols-2 gap-12 mt-12 text-center text-xs">
          <div>
            <p className="text-gray-600 mb-20 font-medium">Penerima (Karyawan),</p>
            <p className="font-bold text-gray-900 border-b border-gray-400 pb-1 inline-block min-w-[200px] uppercase">
              {selectedSlip.nama}
            </p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">Jakarta, {selectedSlip.tanggal}</p>
            <p className="text-gray-600 mb-20 font-medium">Disahkan oleh (HRD & Finance),</p>
            <p className="font-bold text-gray-900 border-b border-gray-400 pb-1 inline-block min-w-[200px]">
              PT. PILAR SENTRA SOLUSI
            </p>
          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-14 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400 italic">
          Dokumen ini diterbitkan secara resmi melalui Sistem Payroll Elektronik PT. Pilar Sentra Solusi dan merupakan bukti penerimaan gaji yang sah.
        </div>
      </div>
    )}
    </>
  );
}
