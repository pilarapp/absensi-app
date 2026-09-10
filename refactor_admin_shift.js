const fs = require('fs');
const path = require('path');

const filePath = path.join('f:', 'Absen PILAR', 'absensi-app', 'src', 'app', 'admin', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update Karyawan Type
content = content.replace(
  'lokasiId: string;\n  gajiPokok: number;',
  'lokasiId: string;\n  shiftMasuk?: string;\n  shiftKeluar?: string;\n  gajiPokok: number;'
);

// 2. Add Shift States
const statesToReplace = `  const [formLokasiId, setFormLokasiId] = useState("all");
  const [formGajiPokok, setFormGajiPokok] = useState("0");`;

const newStates = `  const [formLokasiId, setFormLokasiId] = useState("all");
  const [formShiftMasuk, setFormShiftMasuk] = useState("08:00");
  const [formShiftKeluar, setFormShiftKeluar] = useState("17:00");
  const [formGajiPokok, setFormGajiPokok] = useState("0");`;

content = content.replace(statesToReplace, newStates);

// 3. Update openAddModal
const addModalOld = `    setFormLokasiId("all");
    setFormGajiPokok("0");
    setIsModalOpen(true);`;

const addModalNew = `    setFormLokasiId("all");
    setFormShiftMasuk("08:00");
    setFormShiftKeluar("17:00");
    setFormGajiPokok("0");
    setIsModalOpen(true);`;

content = content.replace(addModalOld, addModalNew);

// 4. Update openEditModal
const editModalOld = `    setFormLokasiId(k.lokasiId || "all");
    setFormGajiPokok(k.gajiPokok ? k.gajiPokok.toString() : "0");
    setIsModalOpen(true);`;

const editModalNew = `    setFormLokasiId(k.lokasiId || "all");
    setFormShiftMasuk(k.shiftMasuk || "08:00");
    setFormShiftKeluar(k.shiftKeluar || "17:00");
    setFormGajiPokok(k.gajiPokok ? k.gajiPokok.toString() : "0");
    setIsModalOpen(true);`;

content = content.replace(editModalOld, editModalNew);

// 5. Update handleSaveKaryawan body
const saveBodyOld = `          lokasiId: formLokasiId,
          gajiPokok: parseInt(formGajiPokok) || 0`;

const saveBodyNew = `          lokasiId: formLokasiId,
          shiftMasuk: formShiftMasuk,
          shiftKeluar: formShiftKeluar,
          gajiPokok: parseInt(formGajiPokok) || 0`;

content = content.replace(saveBodyOld, saveBodyNew);

// 6. Update JSX to include the input fields for Shift Masuk and Shift Keluar
const inputsOld = `                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Lokasi Kerja</label>
                    <CustomSelect 
                      options={[
                        { value: "all", label: "Semua Lokasi" },
                        ...locations.map(loc => ({ value: loc.id, label: loc.nama }))
                      ]}
                      value={formLokasiId}
                      onChange={setFormLokasiId}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Gaji Pokok (Rp)</label>`;

const inputsNew = `                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Lokasi Kerja</label>
                    <CustomSelect 
                      options={[
                        { value: "all", label: "Semua Lokasi" },
                        ...locations.map(loc => ({ value: loc.id, label: loc.nama }))
                      ]}
                      value={formLokasiId}
                      onChange={setFormLokasiId}
                      className="w-full"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Shift Masuk</label>
                      <input type="time" value={formShiftMasuk} onChange={(e) => setFormShiftMasuk(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-pilar-gold transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Shift Pulang</label>
                      <input type="time" value={formShiftKeluar} onChange={(e) => setFormShiftKeluar(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-pilar-gold transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Gaji Pokok (Rp)</label>`;

content = content.replace(inputsOld, inputsNew);

// Since there is another place where it might be rendered, I need to check if the replace worked
fs.writeFileSync(filePath, content);
console.log("Refactored admin/page.tsx for multi-shift");
