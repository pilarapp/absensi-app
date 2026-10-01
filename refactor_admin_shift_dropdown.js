const fs = require('fs');

function refactorAdmin() {
  const filePath = 'src/app/admin/page.tsx';
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add fields to type Karyawan
  content = content.replace(
    /shiftKeluar\?: string;/,
    `shiftKeluar?: string;\n  tipeKerja?: "Fix Time" | "Shift";\n  shifts?: {name: string; masuk: string; keluar: string}[];`
  );

  // 2. Add State for Form
  content = content.replace(
    /const \[formShiftKeluar, setFormShiftKeluar\] = useState\("17:00"\);/,
    `const [formShiftKeluar, setFormShiftKeluar] = useState("17:00");\n  const [formTipeKerja, setFormTipeKerja] = useState<"Fix Time" | "Shift">("Fix Time");\n  const [formShifts, setFormShifts] = useState<{name: string, masuk: string, keluar: string}[]>([\n    {name: 'Shift Pagi', masuk: '08:00', keluar: '20:00'},\n    {name: 'Shift Malam', masuk: '20:00', keluar: '08:00'},\n    {name: 'Shift Full', masuk: '08:00', keluar: '08:00'}\n  ]);`
  );

  // 3. Reset state on add/edit
  // We need to find where editingKaryawan is set to null (add new)
  content = content.replace(
    /setFormShiftMasuk\("08:00"\);\s*setFormShiftKeluar\("17:00"\);/,
    `setFormShiftMasuk("08:00");\n    setFormShiftKeluar("17:00");\n    setFormTipeKerja("Fix Time");\n    setFormShifts([\n      {name: 'Shift Pagi', masuk: '08:00', keluar: '20:00'},\n      {name: 'Shift Malam', masuk: '20:00', keluar: '08:00'},\n      {name: 'Shift Full', masuk: '08:00', keluar: '08:00'}\n    ]);`
  );

  // In editKaryawan function (which sets form from k)
  content = content.replace(
    /setFormShiftMasuk\(k\.shiftMasuk \|\| "08:00"\);\s*setFormShiftKeluar\(k\.shiftKeluar \|\| "17:00"\);/,
    `setFormShiftMasuk(k.shiftMasuk || "08:00");\n    setFormShiftKeluar(k.shiftKeluar || "17:00");\n    setFormTipeKerja(k.tipeKerja || "Fix Time");\n    setFormShifts(k.shifts || [\n      {name: 'Shift Pagi', masuk: '08:00', keluar: '20:00'},\n      {name: 'Shift Malam', masuk: '20:00', keluar: '08:00'},\n      {name: 'Shift Full', masuk: '08:00', keluar: '08:00'}\n    ]);`
  );

  // 4. Pass to API in handleSaveKaryawan
  content = content.replace(
    /shiftMasuk: formShiftMasuk \|\| "08:00",\s*shiftKeluar: formShiftKeluar \|\| "17:00",/,
    `shiftMasuk: formShiftMasuk || "08:00",\n          shiftKeluar: formShiftKeluar || "17:00",\n          tipeKerja: formTipeKerja,\n          shifts: formShifts,`
  );

  // 5. Add UI in Modal
  const uiTarget = `<div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-700 mb-2">Jam Masuk (Wajib)</label>
                        <input type="time" value={formShiftMasuk} onChange={(e) => setFormShiftMasuk(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all text-sm bg-gray-50/50 focus:bg-white" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-700 mb-2">Jam Keluar (Wajib)</label>
                        <input type="time" value={formShiftKeluar} onChange={(e) => setFormShiftKeluar(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all text-sm bg-gray-50/50 focus:bg-white" />
                      </div>
                    </div>`;
  const uiReplacement = `
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-gray-700 mb-2">Tipe Waktu Kerja</label>
                      <select value={formTipeKerja} onChange={(e) => setFormTipeKerja(e.target.value as any)} className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all text-sm bg-gray-50/50 focus:bg-white">
                        <option value="Fix Time">Fix Time (Jam Tetap)</option>
                        <option value="Shift">Shift (Pilih saat Absen)</option>
                      </select>
                    </div>

                    {formTipeKerja === 'Fix Time' ? (
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-gray-700 mb-2">Jam Masuk (Wajib)</label>
                          <input type="time" value={formShiftMasuk} onChange={(e) => setFormShiftMasuk(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all text-sm bg-gray-50/50 focus:bg-white" />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-gray-700 mb-2">Jam Keluar (Wajib)</label>
                          <input type="time" value={formShiftKeluar} onChange={(e) => setFormShiftKeluar(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all text-sm bg-gray-50/50 focus:bg-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <h4 className="text-xs font-bold text-gray-700 mb-2">Pengaturan Pilihan Shift</h4>
                        {formShifts.map((shift, idx) => (
                          <div key={idx} className="flex flex-col gap-2 p-3 bg-white border border-gray-200 rounded-lg">
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="block text-[10px] text-gray-500 mb-1">Nama Shift</label>
                                <input type="text" value={shift.name} onChange={(e) => {
                                  const newShifts = [...formShifts];
                                  newShifts[idx].name = e.target.value;
                                  setFormShifts(newShifts);
                                }} className="w-full border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-pilar-darker" />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="block text-[10px] text-gray-500 mb-1">Masuk</label>
                                <input type="time" value={shift.masuk} onChange={(e) => {
                                  const newShifts = [...formShifts];
                                  newShifts[idx].masuk = e.target.value;
                                  setFormShifts(newShifts);
                                }} className="w-full border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-pilar-darker" />
                              </div>
                              <div className="flex-1">
                                <label className="block text-[10px] text-gray-500 mb-1">Keluar</label>
                                <input type="time" value={shift.keluar} onChange={(e) => {
                                  const newShifts = [...formShifts];
                                  newShifts[idx].keluar = e.target.value;
                                  setFormShifts(newShifts);
                                }} className="w-full border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-pilar-darker" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}`;

  // Find exact snippet or replace manually if multiline regex is tricky. Let's use simple replace.
  // We'll replace the block.
  if (content.includes('Jam Masuk (Wajib)')) {
    const startIndex = content.indexOf('<div className="flex gap-4">', content.indexOf('Jam Masuk (Wajib)') - 200);
    const endIndex = content.indexOf('</div>', content.indexOf('Jam Keluar (Wajib)')) + 30; // approx
    // Using string replacement on large block can be brittle. We can use a regex.
    content = content.replace(
      /<div className="flex gap-4">\s*<div className="flex-1">\s*<label className="block text-xs font-semibold text-gray-700 mb-2">Jam Masuk \(Wajib\)<\/label>[\s\S]*?<input type="time" value=\{formShiftKeluar\}[\s\S]*?<\/div>\s*<\/div>/,
      uiReplacement
    );
  }

  fs.writeFileSync(filePath, content);
  console.log("Admin refactored");
}

refactorAdmin();
