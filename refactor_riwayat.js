const fs = require('fs');
const path = require('path');

const filePath = path.join('f:', 'Absen PILAR', 'absensi-app', 'src', 'app', 'riwayat', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Update imports
content = content.replace(
  'import NotificationBell from "@/components/NotificationBell";',
  'import NotificationBell from "@/components/NotificationBell";\nimport { subscribeToAllAttendance } from "@/lib/db";\nimport { auth } from "@/lib/firebase";\nimport { onAuthStateChanged } from "firebase/auth";'
);

// Remove dummyRiwayat completely
content = content.replace(/const dummyRiwayat: RiwayatAbsen\[\] = \[\s*\{[\s\S]*?\}\s*\];/g, '');

const stateToReplace = `  const [toastMessage, setToastMessage] = useState("");

  const filteredRiwayat = dummyRiwayat.filter((item) => {
    const [year, month] = item.tanggal.split("-");
    return year === selectedYear && month === selectedMonth;
  });`;

const newState = `  const [toastMessage, setToastMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [riwayatAbsen, setRiwayatAbsen] = useState<RiwayatAbsen[]>([]);

  useEffect(() => {
    let unsubscribeAttendance: any;
    
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        // Subscribe to all attendance, we will filter by UID locally since subscribeToAllAttendance fetches all.
        // Wait, subscribeToAllAttendance doesn't take UID! It fetches everything.
        // But for employee we only want their own.
        unsubscribeAttendance = subscribeToAllAttendance((data) => {
          const myAttendance = data.filter(d => d.karyawanId === user.uid).map(d => ({
            id: d.id as any,
            tanggal: new Date(d.tanggal.split("/").reverse().join("-")).toISOString().split("T")[0] || d.tanggal, // Try format to YYYY-MM-DD
            jamMasuk: d.jamMasuk || "-",
            jamKeluar: d.jamKeluar || "-",
            status: d.status || "Hadir",
            keterangan: "-"
          }));
          
          // Re-format tanggal to YYYY-MM-DD reliably
          const formattedAttendance = data.filter(d => d.karyawanId === user.uid).map(d => {
             let isoDate = d.tanggal; // Fallback
             try {
                // if d.tanggal is DD/MM/YYYY
                const parts = d.tanggal.split("/");
                if (parts.length === 3) {
                   isoDate = \`\${parts[2]}-\${parts[1].padStart(2, '0')}-\${parts[0].padStart(2, '0')}\`;
                }
             } catch(e) {}
             
             return {
               id: d.id as any,
               tanggal: isoDate,
               jamMasuk: d.jamMasuk || "-",
               jamKeluar: d.jamKeluar || "-",
               status: d.status || "Hadir",
               keterangan: "-"
             };
          });
          
          setRiwayatAbsen(formattedAttendance);
        });
      } else {
        setCurrentUser(null);
        setRiwayatAbsen([]);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeAttendance) unsubscribeAttendance();
    };
  }, []);

  const filteredRiwayat = riwayatAbsen.filter((item) => {
    const [year, month] = item.tanggal.split("-");
    return year === selectedYear && month === selectedMonth;
  });
  
  // Urutkan dari tanggal terbaru
  filteredRiwayat.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
`;

content = content.replace(stateToReplace, newState);

fs.writeFileSync(filePath, content);
console.log("Refactored riwayat/page.tsx");
