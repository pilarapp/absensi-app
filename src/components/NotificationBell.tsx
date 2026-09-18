"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { subscribeToNotifications, markNotificationRead, subscribeToEmployeeSP, SuratPeringatan } from "@/lib/db";

type Toast = {
  id: number;
  message: string;
  type: "success" | "error";
};

type BellNotification = {
  id: string | number;
  msg: string;
  time: string;
  isRead?: boolean;
  url?: string;
  isSp?: boolean;
  isGaji?: boolean;
  createdAt?: string;
};

export default function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<BellNotification[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [userIds, setUserIds] = useState<string[]>([]);
  const [dbNotifications, setDbNotifications] = useState<BellNotification[]>([]);
  const [spNotifications, setSpNotifications] = useState<BellNotification[]>([]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserIds([user.uid]);
      } else {
        setUserIds([]);
      }
    });
    return () => unsubAuth();
  }, []);

  // Listen to Firestore Notifications
  useEffect(() => {
    if (!userIds || userIds.length === 0) {
      setDbNotifications([]);
      return;
    }

    const unsubNotifs = subscribeToNotifications(userIds, (data) => {
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      const mapped = data.map(d => {
        const message = d.message || d.title || "";
        const title = d.title || "";
        const lowerTitle = title.toLowerCase();
        const lowerMsg = message.toLowerCase();
        
        let url = "/riwayat";
        let isSp = false;
        let isGaji = false;
        if (lowerTitle.includes("pengajuan") || lowerMsg.includes("pengajuan")) {
          url = "/pengajuan";
        } else if (lowerTitle.includes("peringatan") || lowerMsg.includes("peringatan") || lowerTitle.includes("sp") || lowerMsg.includes("sp")) {
          url = "/pengaturan?open=sp";
          isSp = true;
        } else if (lowerTitle.includes("gaji") || lowerMsg.includes("gaji") || d.type === "gaji" || lowerTitle.includes("slip") || lowerMsg.includes("slip") || lowerTitle.includes("rekening")) {
          url = "/gaji?open=slip";
          isGaji = true;
        }

        return {
          id: d.id,
          msg: message,
          time: d.createdAt ? new Date(d.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Baru',
          isRead: d.isRead,
          url,
          isSp,
          isGaji,
          createdAt: d.createdAt
        };
      });
      setDbNotifications(mapped);
    });

    return () => unsubNotifs();
  }, [userIds.join(',')]);

  // Listen to Employee SPs to ensure active unread SPs always appear in the bell
  useEffect(() => {
    if (!userIds || userIds.length === 0) {
      setSpNotifications([]);
      return;
    }

    const unsubs: (() => void)[] = [];
    userIds.forEach(uid => {
      const unsub = subscribeToEmployeeSP(uid, (spList: SuratPeringatan[]) => {
        const unreadActiveSps = spList.filter(s => s.status === "Aktif" && !s.isAcknowledged);
        const mappedSp: BellNotification[] = unreadActiveSps.map(sp => ({
          id: `sp-${sp.id}`,
          msg: `Pemberitahuan resmi ${sp.tingkatSp} (${sp.nomorSurat}) telah diterbitkan. Buka menu Pengaturan untuk membaca & konfirmasi.`,
          time: sp.tanggalTerbit ? new Date(sp.tanggalTerbit).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'Baru',
          isRead: false,
          url: `/pengaturan?open=sp&spId=${sp.id}`,
          isSp: true,
          createdAt: sp.tanggalTerbit
        }));
        setSpNotifications(mappedSp);
      });
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach(u => u());
    };
  }, [userIds.join(',')]);

  // Merge and deduplicate notifications
  useEffect(() => {
    const combined = [...spNotifications];
    dbNotifications.forEach(dbN => {
      // If spNotifications already has this SP, avoid duplicate
      const alreadyHas = combined.some(c => c.msg === dbN.msg);
      if (!alreadyHas) {
        combined.push(dbN);
      }
    });

    setNotifications(combined);
    setUnreadCount(combined.filter(m => !m.isRead).length);
  }, [dbNotifications, spNotifications]);

  const handleNotificationClick = (n: BellNotification) => {
    setShowNotif(false);

    if (!n.isRead && typeof n.id === "string" && !n.id.startsWith("sp-")) {
      markNotificationRead(n.id);
    }

    const targetUrl = n.url || "/riwayat";

    if (targetUrl.includes("/pengaturan") || n.isSp) {
      const spId = typeof n.id === "string" && n.id.startsWith("sp-") ? n.id.replace("sp-", "") : undefined;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pilar_open_sp", { detail: { spId } }));
      }
      router.push(spId ? `/pengaturan?open=sp&spId=${spId}` : "/pengaturan?open=sp");
      return;
    }

    if (targetUrl.includes("/gaji") || n.isGaji) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pilar_open_slip"));
      }
      router.push("/gaji?open=slip");
      return;
    }

    router.push(targetUrl);
  };

  const showToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000); 
  };

  return (
    <>
      <div className="flex items-center space-x-2 relative z-50">
        <button 
          onClick={() => {
            setShowNotif(!showNotif);
            if (!showNotif) { 
              setUnreadCount(0); 
              notifications.forEach((n: any) => { 
                if (!n.isRead && typeof n.id === "string" && !n.id.startsWith("sp-")) {
                  markNotificationRead(n.id);
                }
              }); 
            }
          }}
          className="relative p-2 text-pilar-textSecondary hover:text-pilar-gold transition-colors"
        >
          <i className="fa-regular fa-bell text-xl"></i>
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full border-2 border-pilar-darker flex items-center justify-center shadow-md animate-pulse leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* Full Screen Notification Modal */}
        {showNotif && (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[400px] h-[100vh] max-h-[850px] bg-pilar-darker z-[200] flex flex-col animate-slide-up overflow-hidden shadow-2xl">
            <div className="pt-10 px-6 pb-4 border-b border-white/10 flex justify-between items-center bg-black/20 shrink-0">
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => setShowNotif(false)}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <i className="fa-solid fa-arrow-left"></i>
                </button>
                <h3 className="font-bold text-white text-lg">Notifikasi</h3>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {notifications.length > 0 ? (
                <div className="divide-y divide-white/5">
                  {notifications.map((n) => (
                    <div 
                      key={n.id} 
                      onClick={() => handleNotificationClick(n)}
                      className="block p-5 hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${n.isSp || n.isGaji ? "bg-pilar-gold/20 text-pilar-gold" : "bg-pilar-gold/10 text-pilar-gold"}`}>
                          <i className={n.isSp ? "fa-solid fa-triangle-exclamation text-sm" : n.isGaji ? "fa-solid fa-sack-dollar text-sm" : "fa-regular fa-bell text-base"}></i>
                        </div>
                        <div className="flex-1">
                          {n.isSp && (
                            <span className="inline-block px-2 py-0.5 mb-1.5 text-[10px] font-black uppercase tracking-wider bg-pilar-gold/20 text-pilar-gold border border-pilar-gold/30 rounded-full">
                              Surat Peringatan
                            </span>
                          )}
                          {n.isGaji && (
                            <span className="inline-block px-2 py-0.5 mb-1.5 text-[10px] font-black uppercase tracking-wider bg-pilar-gold/20 text-pilar-gold border border-pilar-gold/30 rounded-full">
                              Slip Gaji
                            </span>
                          )}
                          <p className="text-sm text-gray-200 leading-relaxed font-medium">{n.msg}</p>
                          <span className="text-xs text-gray-500 mt-2 block">{n.time}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 p-6">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
                    <i className="fa-regular fa-bell-slash text-3xl"></i>
                  </div>
                  <p className="text-sm font-medium">Belum ada notifikasi baru.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toast Container */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 w-11/12 max-w-sm z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              ${toast.type === "success" ? "bg-green-500/90" : "bg-red-500/90"}
              text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 
              animate-slide-down backdrop-blur-sm border border-white/20
            `}
          >
            <i className={`fa-solid ${toast.type === "success" ? "fa-check-circle" : "fa-exclamation-circle"} text-xl`}></i>
            <span className="font-medium text-sm">{toast.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}
