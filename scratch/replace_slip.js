const fs = require('fs');

const path = 'f:\\Absen PILAR\\absensi-app\\src\\app\\admin\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

const startIndex = content.indexOf('      {/* MODAL SLIP GAJI RESMI ADMIN */}');
if (startIndex === -1) throw new Error("Start not found");

// The block ends right before `    </div>\n  );\n}`
const endIndexStr = '    </div>\n  );\n}';
const endIndexStrWin = '    </div>\r\n  );\r\n}';
let endIndex = content.lastIndexOf(endIndexStr);
if (endIndex === -1) {
  endIndex = content.lastIndexOf(endIndexStrWin);
}
if (endIndex === -1) {
  // Try finding just '  );'
  endIndex = content.lastIndexOf('  );');
  // Need to backtrack to the closing div of the main container
  endIndex = content.lastIndexOf('    </div>', endIndex);
}

if (endIndex === -1) throw new Error("End not found");

const beforeBlock = content.substring(0, startIndex);
const afterBlock = content.substring(endIndex);

const newBlock = `      {/* MODAL SLIP GAJI RESMI ADMIN */}
      {selectedAdminSlip && (
        <div className="fixed inset-0 z-50 bg-gray-900/90 backdrop-blur-sm flex justify-center overflow-y-auto p-2 sm:p-8 animate-in fade-in pb-safe">
          {/* Action Buttons Floating on top (Hidden on Print) */}
          <div className="fixed top-4 right-4 sm:top-8 sm:right-10 flex space-x-2 print:hidden z-[60]">
            <button onClick={() => window.print()} className="bg-pilar-darker text-pilar-gold px-4 py-2 rounded-xl shadow-lg hover:bg-black font-bold text-xs flex items-center space-x-2 transition-all">
              <i className="fa-solid fa-print"></i> <span>Cetak</span>
            </button>
            <button onClick={() => setSelectedAdminSlip(null)} className="w-10 h-10 rounded-xl bg-red-500/90 text-white shadow-lg hover:bg-red-600 font-bold flex items-center justify-center transition-all">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div 
            id="print-section" 
            className="bg-white text-black font-sans p-6 sm:p-10 md:p-12 w-full max-w-4xl shadow-2xl sm:my-auto my-0 min-h-screen sm:min-h-0 relative" 
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 p-4 rounded-xl border border-gray-300 bg-gray-50/70 text-xs">
              <div className="space-y-2">
                <div className="grid grid-cols-[120px_auto_1fr] gap-2">
                  <span className="text-gray-600 font-medium">Nama Karyawan</span>
                  <span className="text-gray-400">:</span>
                  <span className="font-bold text-gray-900 uppercase">{selectedAdminSlip.nama}</span>
                </div>
                <div className="grid grid-cols-[120px_auto_1fr] gap-2">
                  <span className="text-gray-600 font-medium">Nomor Slip</span>
                  <span className="text-gray-400">:</span>
                  <span className="font-mono font-bold text-gray-800">{selectedAdminSlip.id}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-[120px_auto_1fr] gap-2">
                  <span className="text-gray-600 font-medium">Tanggal Pencairan</span>
                  <span className="text-gray-400">:</span>
                  <span className="font-bold text-gray-900">{selectedAdminSlip.tanggal}</span>
                </div>
                <div className="grid grid-cols-[120px_auto_1fr] gap-2">
                  <span className="text-gray-600 font-medium">Status Pembayaran</span>
                  <span className="text-gray-400">:</span>
                  <span className="font-extrabold text-emerald-700">LUNAS / BERHASIL DITRANSFER</span>
                </div>
              </div>
            </div>

            {/* TABEL PENGHASILAN & POTONGAN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
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
                      Rp {new Intl.NumberFormat('id-ID').format(selectedAdminSlip.gajiPokok || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100 text-gray-400">
                    <span>Tunjangan Operasional</span>
                    <span>Rp 0</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-300 font-extrabold text-gray-900 text-sm">
                    <span>Total Penghasilan (A)</span>
                    <span className="text-pilar-darker">
                      Rp {new Intl.NumberFormat('id-ID').format(selectedAdminSlip.gajiPokok || 0)}
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
                    <span className="text-gray-700">Potongan Alpa ({selectedAdminSlip.alpa || 0} Hari)</span>
                    <span className={(selectedAdminSlip.potonganAlpa || 0) > 0 ? "font-bold text-red-600" : "text-gray-500"}>
                      {(selectedAdminSlip.potonganAlpa || 0) > 0 
                        ? \`- Rp \${new Intl.NumberFormat('id-ID').format(selectedAdminSlip.potonganAlpa!)}\` 
                        : "Rp 0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-gray-100">
                    <span className="text-gray-700">BPJS Ketenagakerjaan ({selectedAdminSlip.bpjsTkRate ?? 2}%)</span>
                    <span className={(selectedAdminSlip.potonganBpjsTk || 0) > 0 ? "font-bold text-red-600" : "text-gray-500"}>
                      {(selectedAdminSlip.potonganBpjsTk || 0) > 0 
                        ? \`- Rp \${new Intl.NumberFormat('id-ID').format(selectedAdminSlip.potonganBpjsTk!)}\` 
                        : "Rp 0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-gray-100">
                    <span className="text-gray-700">BPJS Kesehatan ({selectedAdminSlip.bpjsKesRate ?? 1}%)</span>
                    <span className={(selectedAdminSlip.potonganBpjsKes || 0) > 0 ? "font-bold text-red-600" : "text-gray-500"}>
                      {(selectedAdminSlip.potonganBpjsKes || 0) > 0 
                        ? \`- Rp \${new Intl.NumberFormat('id-ID').format(selectedAdminSlip.potonganBpjsKes!)}\` 
                        : "Rp 0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-300 font-extrabold text-red-600 text-sm">
                    <span className="text-gray-800">Total Potongan (B)</span>
                    <span>
                      {(selectedAdminSlip.potongan || 0) > 0 
                        ? \`- Rp \${new Intl.NumberFormat('id-ID').format(selectedAdminSlip.potongan)}\` 
                        : "Rp 0"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* HIGHLIGHT BOX: TAKE HOME PAY */}
            <div className="border-2 border-pilar-darker rounded-2xl p-4 sm:p-5 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 shadow-sm space-y-4 sm:space-y-0">
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                  Gaji Bersih Diterima (Take Home Pay = A - B)
                </span>
                <span className="text-2xl font-black text-pilar-darker tracking-tight">
                  Rp {new Intl.NumberFormat('id-ID').format(selectedAdminSlip.gajiBersih || 0)}
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
            <div className="grid grid-cols-2 gap-4 sm:gap-12 mt-12 text-center text-xs">
              <div>
                <p className="text-gray-600 mb-20 font-medium">Penerima (Karyawan),</p>
                <p className="font-bold text-gray-900 border-b border-gray-400 pb-1 inline-block min-w-[120px] sm:min-w-[200px] uppercase">
                  {selectedAdminSlip.nama}
                </p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Jakarta, {selectedAdminSlip.tanggal}</p>
                <p className="text-gray-600 mb-20 font-medium">Disahkan oleh (HRD & Finance),</p>
                <p className="font-bold text-gray-900 border-b border-gray-400 pb-1 inline-block min-w-[120px] sm:min-w-[200px]">
                  PT. PILAR SENTRA SOLUSI
                </p>
              </div>
            </div>

            {/* FOOTER */}
            <div className="mt-14 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400 italic">
              Dokumen ini diterbitkan secara resmi melalui Sistem Payroll Elektronik PT. Pilar Sentra Solusi dan merupakan bukti penerimaan gaji yang sah.
            </div>
          </div>
        </div>
      )}
`;

fs.writeFileSync(path, beforeBlock + newBlock + '\n' + afterBlock, 'utf8');
