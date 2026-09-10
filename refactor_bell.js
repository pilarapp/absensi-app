const fs = require('fs');
const path = require('path');

const filePath = path.join('f:', 'Absen PILAR', 'absensi-app', 'src', 'components', 'NotificationBell.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Update imports
content = content.replace(
  'import { useState, useEffect } from "react";',
  'import { useState, useEffect } from "react";\nimport { auth } from "@/lib/firebase";\nimport { onAuthStateChanged } from "firebase/auth";\nimport { subscribeToNotifications, markNotificationRead } from "@/lib/db";'
);

// Replace useEffect for localStorage
const useEffectOld = `
  useEffect(() => {
    const savedNotifs = localStorage.getItem("pilar_employee_notifications");
    if (savedNotifs) {
      setNotifications(JSON.parse(savedNotifs));
    }
  }, []);
`;

const useEffectNew = `
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) setUserId(user.uid);
      else setUserId(null);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const unsubNotifs = subscribeToNotifications(userId, (data) => {
      // Sort newest first
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      const mapped = data.map(d => ({
        id: d.id,
        msg: d.message || d.title,
        time: new Date(d.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        isRead: d.isRead
      }));
      setNotifications(mapped as any);
      setUnreadCount(mapped.filter(m => !m.isRead).length);
    });
    return () => unsubNotifs();
  }, [userId]);
`;
content = content.replace(useEffectOld, useEffectNew);

// Replace handleStorage
const handleStorageOld = `
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'user_notif' && e.newValue) {
        const notif = JSON.parse(e.newValue);
        showToast(notif.msg, "success");
        
        setNotifications(prev => {
          const newList = [
            { id: notif.id, msg: notif.msg, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }, 
            ...prev
          ];
          localStorage.setItem("pilar_employee_notifications", JSON.stringify(newList));
          return newList;
        });
        setUnreadCount(prev => prev + 1);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
`;

content = content.replace(handleStorageOld, '');

content = content.replace(/{notifications.length > 0 && \([\s\S]*?\)}/g, '');

content = content.replace(
  'if (!showNotif) setUnreadCount(0);',
  'if (!showNotif) { setUnreadCount(0); notifications.forEach((n: any) => { if(!n.isRead) markNotificationRead(n.id); }); }'
);

fs.writeFileSync(filePath, content);
console.log("Refactored NotificationBell.tsx");
