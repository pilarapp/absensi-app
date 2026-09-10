const fs = require('fs');
const path = require('path');

const filePath = path.join('f:', 'Absen PILAR', 'absensi-app', 'src', 'app', 'pengajuan', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
content = content.replace(
  'import { submitRequest, updateRequest, fetchRequestById, subscribeToRequests } from "@/lib/db";',
  'import { submitRequest, updateRequest, fetchRequestById, subscribeToRequests, addNotification, getEmployee } from "@/lib/db";\nimport { auth } from "@/lib/firebase";\nimport { onAuthStateChanged } from "firebase/auth";'
);

// 2. Add User state and update useEffect
const stateToReplace = `  const [activeTab, setActiveTab] = useState<"riwayat" | "antrean" | "baru">("baru");`;
const newState = `  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"riwayat" | "antrean" | "baru">("baru");`;
content = content.replace(stateToReplace, newState);

const useEffectOld = `
  useEffect(() => {
    // Tentukan tab aktif dari mode edit
    const editIdStr = localStorage.getItem("edit_pengajuan_id");
    if (editIdStr) {
      setEditId(editIdStr);
      setActiveTab("baru");
      
      // Fetch request data from Firebase
      fetchRequestById(editIdStr).then(data => {
        if (data) {
          setType(data.type);
          setStartDate(data.startDate);
          setEndDate(data.endDate);
          setReason(data.reason);
          setAdditionalNotes(data.additionalNotes || "");
          setDelegationName(data.delegationName || "");
          setDelegationId(data.delegationId || "");
          setDelegationRole(data.delegationRole || "");
          setFileNames(data.files?.map((f:any) => f.name) || []);
        }
      });
    }

    // Subscribe ke Firebase realtime
    const unsubscribe = subscribeToRequests((data) => {
      // Ambil hanya pengajuan milik user Budi Santoso (ID mock)
      const myRequests = data.filter(req => req.karyawanId === "PLR-2023-089");
      myRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setRiwayatPengajuan(myRequests);
      setWaitingCount(myRequests.filter(req => req.status === "Menunggu").length);
    });

    return () => unsubscribe();
  }, []);
`;

const useEffectNew = `
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const emp = await getEmployee(user.uid);
        setCurrentUser(emp);
      } else {
        setCurrentUser(null);
      }
    });

    const editIdStr = localStorage.getItem("edit_pengajuan_id");
    if (editIdStr) {
      setEditId(editIdStr);
      setActiveTab("baru");
      
      fetchRequestById(editIdStr).then(data => {
        if (data) {
          setType(data.type);
          setStartDate(data.startDate);
          setEndDate(data.endDate);
          setReason(data.reason);
          setAdditionalNotes(data.additionalNotes || "");
          setDelegationName(data.delegationName || "");
          setDelegationId(data.delegationId || "");
          setDelegationRole(data.delegationRole || "");
          setFileNames(data.files?.map((f:any) => f.name) || []);
        }
      });
    }

    const unsubscribe = subscribeToRequests((data) => {
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRiwayatPengajuan(data); 
    });

    return () => {
      unsubAuth();
      unsubscribe();
    };
  }, []);
`;
content = content.replace(useEffectOld, useEffectNew);

// Fix the render filtering
content = content.replace(/riwayatPengajuan\.map/g, 'riwayatPengajuan.filter((r: any) => currentUser && r.karyawanId === currentUser.id).map');
content = content.replace(/\{waitingCount\}/g, '{riwayatPengajuan.filter((r: any) => currentUser && r.karyawanId === currentUser.id && r.status === "Menunggu").length}');

// 3. Update notify Admin
const notifyAdminUpdateOld = `
        // Notify Admin (we'll keep it in local storage for now until we migrate admin notifs)
        const currentAdminNotifs = JSON.parse(localStorage.getItem("admin_notif_list") || "[]");
        currentAdminNotifs.unshift({ 
          id: Date.now(), 
          msg: \`Karyawan Budi Santoso telah merevisi pengajuan \${type}.\` 
        });
        localStorage.setItem("admin_notif_list", JSON.stringify(currentAdminNotifs));
`;
const notifyAdminUpdateNew = `
        const namaKaryawan = currentUser ? currentUser.nama : "Karyawan";
        addNotification("admin", "Revisi Pengajuan", \`Karyawan \${namaKaryawan} telah merevisi pengajuan \${type}.\`, "info");
`;
content = content.replace(notifyAdminUpdateOld, notifyAdminUpdateNew);

const newPengajuanOld = `
        // Save new pengajuan to Firestore
        const newPengajuan = {
          karyawanId: "PLR-2023-089",
          karyawanNama: "Budi Santoso",
          karyawanDivisi: "Teknologi Informasi",
          karyawanPosisi: "IT Support",
`;
const newPengajuanNew = `
        const newPengajuan = {
          karyawanId: currentUser ? currentUser.id : "unknown",
          karyawanNama: currentUser ? currentUser.nama : "Karyawan",
          karyawanDivisi: currentUser ? (currentUser.divisi || "-") : "-",
          karyawanPosisi: currentUser ? (currentUser.posisi || "-") : "-",
`;
content = content.replace(newPengajuanOld, newPengajuanNew);

const notifyAdminNewOld = `
          // Notify Admin
          const currentAdminNotifs = JSON.parse(localStorage.getItem("admin_notif_list") || "[]");
          currentAdminNotifs.unshift({ 
            id: Date.now(), 
            msg: \`Ada pengajuan \${type} baru dari Budi Santoso!\` 
          });
          localStorage.setItem("admin_notif_list", JSON.stringify(currentAdminNotifs));
`;
const notifyAdminNewNew = `
          const namaKaryawan = currentUser ? currentUser.nama : "Karyawan";
          addNotification("admin", "Pengajuan Baru", \`Ada pengajuan \${type} baru dari \${namaKaryawan}!\`, "info");
`;
content = content.replace(notifyAdminNewOld, notifyAdminNewNew);


fs.writeFileSync(filePath, content);
console.log("Refactored pengajuan/page.tsx");
