const fs = require('fs');
const path = require('path');

const filePath = path.join('f:', 'Absen PILAR', 'absensi-app', 'src', 'app', 'gaji', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Update imports
content = content.replace(
  'import NotificationBell from "@/components/NotificationBell";',
  'import NotificationBell from "@/components/NotificationBell";\nimport { subscribeToSalaries } from "@/lib/db";\nimport { auth } from "@/lib/firebase";\nimport { onAuthStateChanged } from "firebase/auth";'
);

// Update SlipGaji type to match Firestore string ID
content = content.replace(
  'karyawanId: number;',
  'karyawanId: string;'
);

const loadGajiOld = `
  const loadGaji = () => {
    const saved = localStorage.getItem("pilar_gaji_karyawan");
    if (saved) {
      const data = JSON.parse(saved);
      // Asumsi login sebagai Budi (id: 1)
      const myRiwayat = data.filter((d: SlipGaji) => d.karyawanId === 1);
      setRiwayat(myRiwayat);
    }
  };

  useEffect(() => {
    loadGaji();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'pilar_gaji_karyawan') {
        loadGaji();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
`;

const loadGajiNew = `
  useEffect(() => {
    let unsubscribeSalaries: any;
    
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsubscribeSalaries = subscribeToSalaries(user.uid, (data) => {
          data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setRiwayat(data as any);
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
`;

content = content.replace(loadGajiOld, loadGajiNew);

fs.writeFileSync(filePath, content);
console.log("Refactored gaji/page.tsx");
