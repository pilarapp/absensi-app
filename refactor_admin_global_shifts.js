const fs = require('fs');

function refactorAdmin() {
  const filePath = 'src/app/admin/page.tsx';
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Remove formShifts state setup
  // Note: we can just leave it or remove it. Let's remove the UI block first.
  const uiTarget = `) : (
                    <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100 mb-4">
                      <h4 className="text-xs font-bold text-gray-700 mb-2">Pengaturan Pilihan Shift</h4>`;
                      
  const uiTargetEnd = `)}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Gaji Pokok (Per Bulan)</label>`;

  if (content.includes(uiTarget)) {
    const startIndex = content.indexOf(uiTarget);
    const endIndex = content.indexOf(')}', startIndex) + 2;
    const replacement = `) : (
                    <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 mb-4 flex items-start gap-3">
                      <i className="fa-solid fa-circle-info text-blue-500 mt-0.5"></i>
                      <p className="text-xs text-blue-800 leading-relaxed">
                        Karyawan dengan tipe <strong>Shift</strong> akan memilih jadwal shift secara dinamis saat melakukan absensi. Pilihan shift dan jamnya diatur secara global di menu Pengaturan Perusahaan.
                      </p>
                    </div>
                  )}`;
    content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
  }

  // 2. Add Global Shift settings UI to the Pengaturan tab.
  // Let's find the timezone settings.
  const tzSearch = 'Simpan Pengaturan Zona Waktu';
  if (content.includes(tzSearch)) {
    // Look for the end of the timezone box
    const endOfTzBox = content.indexOf('</div>', content.indexOf(tzSearch)) + 6;
    
    const globalShiftsUI = `
                {/* GLOBAL SHIFTS SETTINGS */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-pilar-gold/10 flex items-center justify-center">
                      <i className="fa-solid fa-clock-rotate-left text-pilar-gold"></i>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Pengaturan Jam Shift (Global)</h3>
                      <p className="text-sm text-gray-500 mt-0.5">Atur pilihan shift yang akan muncul saat karyawan tipe Shift melakukan absen masuk.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {(companySettings?.globalShifts || [
                      { name: 'Shift Pagi', masuk: '08:00', keluar: '20:00' },
                      { name: 'Shift Malam', masuk: '20:00', keluar: '08:00' },
                      { name: 'Shift Full', masuk: '08:00', keluar: '08:00' },
                    ]).map((shift, idx) => (
                      <div key={idx} className="flex gap-4 items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-gray-700 mb-1">Nama Shift</label>
                          <input type="text" value={shift.name} onChange={(e) => {
                            const newShifts = [...(companySettings.globalShifts || [
                              { name: 'Shift Pagi', masuk: '08:00', keluar: '20:00' },
                              { name: 'Shift Malam', masuk: '20:00', keluar: '08:00' },
                              { name: 'Shift Full', masuk: '08:00', keluar: '08:00' }
                            ])];
                            newShifts[idx].name = e.target.value;
                            setCompanySettings({ ...companySettings, globalShifts: newShifts });
                          }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pilar-darker" />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-gray-700 mb-1">Jam Masuk</label>
                          <input type="time" value={shift.masuk} onChange={(e) => {
                            const newShifts = [...(companySettings.globalShifts || [
                              { name: 'Shift Pagi', masuk: '08:00', keluar: '20:00' },
                              { name: 'Shift Malam', masuk: '20:00', keluar: '08:00' },
                              { name: 'Shift Full', masuk: '08:00', keluar: '08:00' }
                            ])];
                            newShifts[idx].masuk = e.target.value;
                            setCompanySettings({ ...companySettings, globalShifts: newShifts });
                          }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pilar-darker" />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-gray-700 mb-1">Jam Keluar</label>
                          <input type="time" value={shift.keluar} onChange={(e) => {
                            const newShifts = [...(companySettings.globalShifts || [
                              { name: 'Shift Pagi', masuk: '08:00', keluar: '20:00' },
                              { name: 'Shift Malam', masuk: '20:00', keluar: '08:00' },
                              { name: 'Shift Full', masuk: '08:00', keluar: '08:00' }
                            ])];
                            newShifts[idx].keluar = e.target.value;
                            setCompanySettings({ ...companySettings, globalShifts: newShifts });
                          }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pilar-darker" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end mt-6">
                    <button 
                      onClick={async () => {
                        setIsUpdatingSettings(true);
                        try {
                          await fetch('/api/settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ globalShifts: companySettings.globalShifts })
                          });
                          showToast('Pengaturan shift berhasil disimpan!', 'success');
                        } catch (err) {
                          showToast('Gagal menyimpan pengaturan shift', 'error');
                        } finally {
                          setIsUpdatingSettings(false);
                        }
                      }}
                      disabled={isUpdatingSettings}
                      className="px-6 py-2.5 bg-pilar-darker text-white text-sm font-bold rounded-xl hover:bg-pilar-dark/90 transition-all shadow-lg flex items-center gap-2"
                    >
                      {isUpdatingSettings ? (
                        <><i className="fa-solid fa-circle-notch fa-spin"></i> Menyimpan...</>
                      ) : (
                        <><i className="fa-solid fa-save"></i> Simpan Shift</>
                      )}
                    </button>
                  </div>
                </div>
`;
    // Find the end of the parent div that holds the timezone settings
    // Wait, the timezone settings might be inside a larger container.
    content = content.substring(0, endOfTzBox) + globalShiftsUI + content.substring(endOfTzBox);
  }

  // 3. Remove shifts array from API payload in handleSaveKaryawan
  content = content.replace(
    /tipeKerja: formTipeKerja,\n\s*shifts: formShifts,/,
    `tipeKerja: formTipeKerja,`
  );

  fs.writeFileSync(filePath, content);
  console.log("Admin page refactored");
}

refactorAdmin();
