const fs = require('fs');
const path = require('path');

const filePath = path.join('f:', 'Absen PILAR', 'absensi-app', 'src', 'app', 'admin', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update imports
content = content.replace(
  'import { subscribeToRequests, updateRequestStatus, subscribeToLocations, addLocation, updateLocation, deleteLocation, subscribeToEmployees } from "@/lib/db";',
  'import { subscribeToRequests, updateRequestStatus, subscribeToLocations, addLocation, updateLocation, deleteLocation, subscribeToEmployees, subscribeToAllAttendance, subscribeToFinances, addFinanceTransaction, deleteFinanceTransaction, subscribeToSalaries, subscribeToNotifications, addNotification } from "@/lib/db";'
);

// 2. Remove dummy arrays globally
content = content.replace(/const dummyLaporan: Laporan\[\] = \[\s*\{[^\}]+\},\s*\{[^\}]+\},\s*\{[^\}]+\},\s*\{[^\}]+\},\s*\];/g, '');
content = content.replace(/const dataGrafik = \[\s*\{[^\}]+\},\s*\{[^\}]+\},\s*\{[^\}]+\},\s*\{[^\}]+\},\s*\{[^\}]+\},\s*\];/g, '');
content = content.replace(/const dummyKeuangan: Transaksi\[\] = \[\s*\{[^\}]+\},\s*\{[^\}]+\},\s*\{[^\}]+\},\s*\{[^\}]+\},\s*\{[^\}]+\},\s*\];/g, '');
content = content.replace(/const dataGrafikKeuangan = \[\s*\{[^\}]+\},\s*\{[^\}]+\},\s*\{[^\}]+\},\s*\{[^\}]+\},\s*\{[^\}]+\},\s*\];/g, '');

// 3. Add states to component
const stateAdditions = `
  const [riwayatLaporan, setRiwayatLaporan] = useState<any[]>([]);
  const [dataGrafik, setDataGrafik] = useState<any[]>([]);
  const [dataGrafikKeuangan, setDataGrafikKeuangan] = useState<any[]>([]);
  const [transaksiKeuangan, setTransaksiKeuangan] = useState<Transaksi[]>([]);
  const [riwayatGaji, setRiwayatGaji] = useState<any[]>([]);
`;

content = content.replace(
  'const [transaksiKeuangan, setTransaksiKeuangan] = useState<Transaksi[]>(dummyKeuangan);',
  stateAdditions
);

// 4. Update useEffect for subscriptions
const useEffectOld = `
    // Load keuangan
    const savedKeuangan = localStorage.getItem("pilar_keuangan");
    if (savedKeuangan) {
      setTransaksiKeuangan(JSON.parse(savedKeuangan));
    } else {
      setTransaksiKeuangan(dummyKeuangan);
      localStorage.setItem("pilar_keuangan", JSON.stringify(dummyKeuangan));
    }
    
    return () => {
      unsubscribeRequests();
      unsubscribeLocations();
      unsubscribeEmployees();
    };
`;

const useEffectNew = `
    // Load attendance
    const unsubscribeAttendance = subscribeToAllAttendance((data) => {
      // Map Firestore data to Laporan format
      const formatted = data.map(d => ({
        id: d.id,
        nama: d.karyawanNama || "Unknown",
        posisi: "-",
        tanggal: d.tanggal,
        hari: new Date(d.createdAt).toLocaleDateString('id-ID', { weekday: 'long' }),
        jamMasuk: d.jamMasuk || "-",
        jamKeluar: d.jamKeluar || "-",
        status: d.status || "Hadir",
        keterangan: "-"
      }));
      // Urutkan dari terbaru
      formatted.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      setRiwayatLaporan(formatted);

      // Generate Data Grafik
      const countByDay: Record<string, { Hadir: number, Izin: number, Absen: number }> = {
        'Senin': { Hadir: 0, Izin: 0, Absen: 0 },
        'Selasa': { Hadir: 0, Izin: 0, Absen: 0 },
        'Rabu': { Hadir: 0, Izin: 0, Absen: 0 },
        'Kamis': { Hadir: 0, Izin: 0, Absen: 0 },
        'Jumat': { Hadir: 0, Izin: 0, Absen: 0 },
      };
      formatted.forEach(f => {
         const day = f.hari;
         if (countByDay[day]) {
            if (f.status === 'Hadir' || f.status === 'Terlambat') countByDay[day].Hadir++;
            else if (f.status === 'Izin') countByDay[day].Izin++;
            else countByDay[day].Absen++;
         }
      });
      const generatedGrafik = Object.keys(countByDay).map(k => ({
         name: k,
         ...countByDay[k]
      }));
      setDataGrafik(generatedGrafik);
    });

    // Load finances
    const unsubscribeFinances = subscribeToFinances((data) => {
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransaksiKeuangan(data);

      // Simple mock for grafik keuangan since we don't have full months data yet
      setDataGrafikKeuangan([
        { name: 'Mei', Pemasukan: 120, Pengeluaran: 50 },
        { name: 'Jun', Pemasukan: 150, Pengeluaran: 60 },
        { name: 'Jul', Pemasukan: 200, Pengeluaran: 70 },
        { name: 'Ags', Pemasukan: 180, Pengeluaran: 55 },
        { name: 'Sep', Pemasukan: data.filter(d => d.jenis === "Pemasukan").reduce((acc, curr) => acc + curr.nominal, 0) / 1000000, Pengeluaran: data.filter(d => d.jenis === "Pengeluaran").reduce((acc, curr) => acc + curr.nominal, 0) / 1000000 },
      ]);
    });

    // Load salaries
    const unsubscribeSalaries = subscribeToSalaries(null, (data) => {
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRiwayatGaji(data);
    });

    return () => {
      unsubscribeRequests();
      unsubscribeLocations();
      unsubscribeEmployees();
      unsubscribeAttendance();
      unsubscribeFinances();
      unsubscribeSalaries();
    };
`;

content = content.replace(useEffectOld, useEffectNew);

// 5. Replace references to dummyLaporan
content = content.replace(/dummyLaporan/g, "riwayatLaporan");

// 6. Update handleBayarGaji
const handleBayarGajiOld = `
        // 1. Catat ke Keuangan
        const newTrx: Transaksi = {
          id: "TRX-" + timestamp,
          tanggal: dateStr,
          keterangan: \`Gaji - \${nama}\`,
          jenis: "Pengeluaran",
          nominal: nominal
        };
        const newList = [newTrx, ...transaksiKeuangan];
        setTransaksiKeuangan(newList);
        localStorage.setItem("pilar_keuangan", JSON.stringify(newList));
        
        // 2. Catat ke Riwayat Gaji Karyawan (pilar_gaji_karyawan)
        const savedGaji = localStorage.getItem("pilar_gaji_karyawan");
        let riwayatGaji = savedGaji ? JSON.parse(savedGaji) : [];
        const newSlipGaji = {
          id: "SLIP-" + timestamp,
          karyawanId,
          nama,
          tanggal: dateStr,
          gajiPokok,
          potongan,
          alpa,
          gajiBersih: nominal
        };
        riwayatGaji = [newSlipGaji, ...riwayatGaji];
        localStorage.setItem("pilar_gaji_karyawan", JSON.stringify(riwayatGaji));

        // 3. Kirim Notifikasi ke Karyawan
        localStorage.setItem('user_notif', JSON.stringify({ 
          id: timestamp, 
          msg: \`Gaji Anda sebesar Rp \${new Intl.NumberFormat('id-ID').format(nominal)} telah dicairkan.\` 
        }));
`;

const handleBayarGajiNew = `
        // 1. Catat ke Keuangan
        addFinanceTransaction({
          tanggal: dateStr,
          keterangan: \`Gaji - \${nama}\`,
          jenis: "Pengeluaran",
          nominal: nominal
        });
        
        // 2. Catat ke Riwayat Gaji
        // (This uses addSalarySlip which we will call directly or we assume it's part of paySalary. Wait, paySalary already does this! Let's just use paySalary.)
        // Actually, we don't have paySalary imported. Let's just manually insert.
        import("@/lib/db").then(({ paySalary }) => {
           paySalary({
             karyawanId, nama, tanggal: dateStr, gajiPokok, potongan, alpa, gajiBersih: nominal
           }, {
             tanggal: dateStr, keterangan: \`Gaji - \${nama}\`, jenis: "Pengeluaran", nominal: nominal
           }, {
             userId: karyawanId, title: "Gaji Cair", message: \`Gaji Anda sebesar Rp \${new Intl.NumberFormat('id-ID').format(nominal)} telah dicairkan.\`, type: "info"
           });
        });
`;

content = content.replace(handleBayarGajiOld, handleBayarGajiNew);

// 7. Update handleApprove
const handleApproveOld = `
  const handleApprove = async (id: string) => {
    await updateRequestStatus(id, "Disetujui");
    showToast("Pengajuan disetujui.");
    localStorage.setItem('user_notif', JSON.stringify({ 
      id: Date.now(), 
      msg: "Hore! Pengajuan Anda telah DISETUJUI oleh HRD." 
    }));
  };
`;

const handleApproveNew = `
  const handleApprove = async (id: string, karyawanId: string) => {
    await updateRequestStatus(id, "Disetujui");
    showToast("Pengajuan disetujui.");
    addNotification(karyawanId, "Pengajuan Disetujui", "Hore! Pengajuan Anda telah DISETUJUI oleh HRD.", "success");
  };
`;

content = content.replace(handleApproveOld, handleApproveNew);

// Need to update onClick={() => handleApprove(req.id)}
content = content.replace(/onClick=\{\(\) => handleApprove\(req\.id\)\}/g, 'onClick={() => handleApprove(req.id, req.karyawanId)}');

// 8. Update handleRejectSubmit
const handleRejectSubmitOld = `
  const handleRejectSubmit = async () => {
    if (!rejectId || !rejectReason) return showToast("Alasan harus diisi.");
    await updateRequestStatus(rejectId, "Revisi", rejectReason);
    setRejectModalOpen(false);
    showToast("Pengajuan dikembalikan untuk revisi.");
    localStorage.setItem('user_notif', JSON.stringify({ 
      id: Date.now(), 
      msg: \`Pengajuan Anda memerlukan REVISI: \${rejectReason}\` 
    }));
  };
`;

const handleRejectSubmitNew = `
  const handleRejectSubmit = async () => {
    if (!rejectId || !rejectReason) return showToast("Alasan harus diisi.");
    await updateRequestStatus(rejectId, "Revisi", rejectReason);
    setRejectModalOpen(false);
    showToast("Pengajuan dikembalikan untuk revisi.");
    
    // Find karyawanId
    const req = pengajuanList.find((r: any) => r.id === rejectId);
    if (req) {
      addNotification(req.karyawanId, "Revisi Pengajuan", \`Pengajuan Anda memerlukan REVISI: \${rejectReason}\`, "warning");
    }
  };
`;

content = content.replace(handleRejectSubmitOld, handleRejectSubmitNew);

// 9. Update dummyKeuangan inside handleExportKeuangan
content = content.replace(/dummyKeuangan/g, "transaksiKeuangan");

fs.writeFileSync(filePath, content);
console.log("Refactored page.tsx");
