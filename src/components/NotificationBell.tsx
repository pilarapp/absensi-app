"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { subscribeToNotifications, markNotificationRead } from "@/lib/db";

type Toast = {
  id: number;
  message: string;
  type: "success" | "error";
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<{id: number, msg: string, time: string, isRead?: boolean, url?: string}[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const { getEmployee } = await import("@/lib/db");
        const emp = await getEmployee(user.uid);
        if (emp && (emp.karyawanId || emp.noInduk)) {
          setUserId(emp.karyawanId || emp.noInduk);
        } else {
          setUserId(user.uid);
        }
      } else {
        setUserId(null);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const unsubNotifs = subscribeToNotifications(userId, (data) => {
      // Sort newest first
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      const mapped = data.map(d => {
        const message = d.message || d.title || "";
        const title = d.title || "";
        
        let url = "/riwayat";
        if (title.toLowerCase().includes("pengajuan") || message.toLowerCase().includes("pengajuan")) {
           url = "/pengajuan";
        }

        return {
          id: d.id,
          msg: message,
          time: new Date(d.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          isRead: d.isRead,
          url
        };
      });
      setNotifications(mapped as any);
      setUnreadCount(mapped.filter(m => !m.isRead).length);
    });
    return () => unsubNotifs();
  }, [userId]);

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
            if (!showNotif) { setUnreadCount(0); notifications.forEach((n: any) => { if(!n.isRead) markNotificationRead(n.id); }); }
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
                    <a 
                      key={n.id} 
                      href={n.url || "/riwayat"}
                      onClick={() => setShowNotif(false)}
                      className="block p-5 hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-pilar-gold/10 text-pilar-gold flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                          <i className="fa-regular fa-bell"></i>
                        </div>
                        <div>
                          <p className="text-sm text-gray-200 leading-relaxed font-medium">{n.msg}</p>
                          <span className="text-xs text-gray-500 mt-2 block">{n.time}</span>
                        </div>
                      </div>
                    </a>
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
