"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { recordCheckIn, recordCheckOut, getTodayAttendance, getEmployee, getEmployeeAttendance, getEmployeeRequests, subscribeToCompanySettings } from '@/lib/db';
import NotificationBell from '@/components/NotificationBell';
import Toast from '@/components/Toast';

// Flag untuk mencegah hydration mismatch antara SSR dan initial client render
let hasMountedOnce = false;

export default function EmployeeDashboard() {
  const router = useRouter();

  // Ambil cache karyawan dari sessionStorage hanya jika sudah pernah mount di client (untuk navigasi SPA antar-tab instan)
  // Pada initial hydration & SSR selalu bernilai null agar struktur HTML konsisten 100%
  const [currentUser, setCurrentUser] = useState<any>(() => {
    if (!hasMountedOnce || typeof window === 'undefined') return null;
    try {
      const cached = sessionStorage.getItem("pilar_cached_employee");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  // isAuthChecking: Pada initial hydration/SSR selalu TRUE agar sama dengan server.
  // Saat SPA navigation (hasMountedOnce === true), langsung gunakan cache sesi agar tanpa flicker.
  const [isAuthChecking, setIsAuthChecking] = useState(() => {
    if (!hasMountedOnce || typeof window === 'undefined') return true;
    const sessionChecked = sessionStorage.getItem("pilar_session_checked") === "true";
    const hasCachedUser = !!sessionStorage.getItem("pilar_cached_employee");
    return !(sessionChecked && hasCachedUser);
  });

  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [appTimezone, setAppTimezone] = useState("Asia/Tokyo");
  const [appTimezoneCode, setAppTimezoneCode] = useState("JST");
  const [timeCheckin, setTimeCheckin] = useState("--:--");
  const [timeCheckout, setTimeCheckout] = useState("--:--");
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isInitializingAttendance, setIsInitializingAttendance] = useState(true);
  const [locationText, setLocationText] = useState("Mendeteksi Lokasi...");
  
  const [stats, setStats] = useState({ hadir: 0, izin: 0, absen: 0 });
  const [recentHistory, setRecentHistory] = useState<any[]>([]);

  const [toasts, setToasts] = useState<any[]>([]);
  
  const showToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // Helper verifikasi apakah string tanggal merujuk pada hari ini
  const isDateToday = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    const now = new Date();
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: appTimezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }).formatToParts(now);
      const d = parseInt(parts.find(p => p.type === 'day')!.value, 10);
      const m = parseInt(parts.find(p => p.type === 'month')!.value, 10);
      const y = parseInt(parts.find(p => p.type === 'year')!.value, 10);

      const candidates = [
        `${d}/${m}/${y}`,
        `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`,
        `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        now.toLocaleDateString("id-ID")
      ];
      if (candidates.includes(dateStr.trim())) return true;
      const clean = dateStr.replace(/-/g, '/').split('/').map(p => parseInt(p, 10)).filter(n => !isNaN(n));
      return clean.includes(d) && clean.includes(m) && clean.includes(y);
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const unsub = subscribeToCompanySettings((settings) => {
      if (settings?.timezone) {
        setAppTimezone(settings.timezone);
        setAppTimezoneCode(settings.timezoneCode || "JST");
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const startTime = Date.now();

    const fetchServerAtt = async (empId: string) => {
       const existingAtt: any = await getTodayAttendance(empId);
       if (existingAtt) {
          if (existingAtt.jamMasuk) {
            setTimeCheckin(existingAtt.jamMasuk);
            setHasCheckedIn(true);
          }
          if (existingAtt.jamKeluar) {
            setTimeCheckout(existingAtt.jamKeluar);
          }
          localStorage.setItem("pilar_today_attendance", JSON.stringify({
             date: existingAtt.tanggal,
             timeCheckin: existingAtt.jamMasuk || "--:--",
             timeCheckout: existingAtt.jamKeluar || null,
             docId: existingAtt.id
          }));
       }
    };

    const fetchHistoryData = async (empId: string) => {
      const attendances = await getEmployeeAttendance(empId);
      const requests = await getEmployeeRequests(empId);
      
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      let hadirCount = 0;
      let izinCount = 0;
      
      const combinedHistory: any[] = [];
      
      attendances.forEach((att: any) => {
         if (!att.tanggal) return;
         let d = '', m = '', y = '';
         if (att.tanggal.includes('-')) {
           const parts = att.tanggal.split('-');
           if (parts[0].length === 4) {
             y = parts[0]; m = parts[1]; d = parts[2];
           } else {
             d = parts[0]; m = parts[1]; y = parts[2];
           }
         } else if (att.tanggal.includes('/')) {
           const parts = att.tanggal.split('/');
           d = parts[0]; m = parts[1]; y = parts[2];
         }
         if (!y || !m || !d) return;

         const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
         if (isNaN(dateObj.getTime())) return;
         
         if (dateObj.getMonth() === currentMonth && dateObj.getFullYear() === currentYear) {
            if (att.status === 'Hadir' || att.status === 'Terlambat') {
              hadirCount++;
            }
         }
         
         combinedHistory.push({
            id: att.id,
            type: 'attendance',
            date: dateObj,
            status: att.status || 'Hadir',
            timeCheckin: att.jamMasuk,
            timeCheckout: att.jamKeluar,
            label: `${dateObj.toLocaleDateString("id-ID", { weekday: 'long' })}, ${d} ${dateObj.toLocaleDateString("id-ID", { month: 'short' })}`
         });
      });
      
      requests.forEach((req: any) => {
         const dateStr = req.startDate || req.tanggalMulai || req.createdAt;
         let dateObj = new Date(dateStr);
         if (typeof dateStr === 'string' && dateStr.includes('/')) {
             const [d, m, y] = dateStr.split('/');
             dateObj = new Date(parseInt(y), parseInt(m)-1, parseInt(d));
         }

         if (req.status === 'Disetujui') {
             if (dateObj.getMonth() === currentMonth && dateObj.getFullYear() === currentYear) {
                 izinCount++;
             }
         }
         
         combinedHistory.push({
            id: req.id,
            type: 'request',
            date: dateObj,
            status: req.type || 'Izin',
            reqStatus: req.status,
            keterangan: req.reason || req.alasan || '-',
            label: `${dateObj.toLocaleDateString("id-ID", { weekday: 'long' })}, ${dateObj.getDate()} ${dateObj.toLocaleDateString("id-ID", { month: 'short' })}`
         });
      });
      
      setStats({ hadir: hadirCount, izin: izinCount, absen: 0 });
      combinedHistory.sort((a, b) => b.date.getTime() - a.date.getTime());
      setRecentHistory(combinedHistory.slice(0, 5));
    };

    const init = async (empId: string) => {
      try {
        const savedAtt = localStorage.getItem("pilar_today_attendance");
        if (savedAtt) {
          try {
            const parsed = JSON.parse(savedAtt);
            if (isDateToday(parsed.date)) {
               if (parsed.timeCheckin && parsed.timeCheckin !== "--:--") {
                 setTimeCheckin(parsed.timeCheckin);
                 setHasCheckedIn(true);
               }
               if (parsed.timeCheckout && parsed.timeCheckout !== "--:--") {
                 setTimeCheckout(parsed.timeCheckout);
               }
            } else {
               localStorage.removeItem("pilar_today_attendance");
            }
          } catch (err) {
            localStorage.removeItem("pilar_today_attendance");
          }
        }
        
        // Selalu sinkronkan dengan database server agar status absensi 100% presisi
        await fetchServerAtt(empId);
        await fetchHistoryData(empId);
      } catch (e) {
        console.error("Error init attendance:", e);
      } finally {
        setIsInitializingAttendance(false);
        setLocationText("");
      }
    };
    
    hasMountedOnce = true;

    // Periksa cache sesi lokal
    const sessionChecked = typeof window !== 'undefined' && sessionStorage.getItem("pilar_session_checked") === "true";
    const cachedEmpStr = typeof window !== 'undefined' ? sessionStorage.getItem("pilar_cached_employee") : null;
    let cachedEmp: any = null;
    if (sessionChecked && cachedEmpStr) {
      try {
        cachedEmp = JSON.parse(cachedEmpStr);
      } catch {}
    }

    const isAlreadyChecked = sessionChecked && !!cachedEmp;
    const MIN_LOADING_TIME = isAlreadyChecked ? 0 : 1000;

    const finishLoading = (action: () => void) => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_LOADING_TIME - elapsed);
      if (remaining === 0) {
        action();
      } else {
        setTimeout(action, remaining);
      }
    };
    
    // Cek awal sesi lokal dengan animasi pemeriksaan sesi
    const hasLocalSession = typeof window !== 'undefined' && (localStorage.getItem("user_email") || localStorage.getItem("pilar_logged_in"));
    if (!hasLocalSession) {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem("pilar_session_checked");
        sessionStorage.removeItem("pilar_cached_employee");
      }
      finishLoading(() => router.replace('/login'));
      return;
    }

    // Jika sudah ada cache pengguna (misal saat refresh halaman), aktifkan langsung setelah mount
    if (isAlreadyChecked && cachedEmp) {
      setCurrentUser(cachedEmp);
      setIsAuthChecking(false);
      init(cachedEmp.id);
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const emp = await getEmployee(user.uid);
        if (emp) {
          try {
            sessionStorage.setItem("pilar_session_checked", "true");
            sessionStorage.setItem("pilar_cached_employee", JSON.stringify(emp));
          } catch {}
          finishLoading(() => {
            setCurrentUser(emp);
            setIsAuthChecking(false);
            init(emp.id);
          });
        } else {
          sessionStorage.removeItem("pilar_session_checked");
          sessionStorage.removeItem("pilar_cached_employee");
          finishLoading(() => router.replace('/login'));
        }
      } else {
        localStorage.removeItem("pilar_logged_in");
        localStorage.removeItem("user_email");
        sessionStorage.removeItem("pilar_session_checked");
        sessionStorage.removeItem("pilar_cached_employee");
        finishLoading(() => router.replace('/login'));
      }
    });

    const updateClock = () => {
      const now = new Date();
      try {
        setCurrentTime(now.toLocaleTimeString("id-ID", { timeZone: appTimezone, hour: '2-digit', minute: '2-digit' }));
        setCurrentDate(now.toLocaleDateString("id-ID", { timeZone: appTimezone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
      } catch (e) {
        setCurrentTime(now.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' }));
        setCurrentDate(now.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
      }
    };
    updateClock();
    timer = setInterval(updateClock, 1000);

    return () => {
      if (timer) clearInterval(timer);
      unsubscribeAuth();
    };
  }, [appTimezone]);

  const handleResetTesting = () => {
    localStorage.removeItem("pilar_today_attendance");
    setTimeCheckin("--:--");
    setTimeCheckout("--:--");
    setHasCheckedIn(false);
    showToast("Data absen direset untuk testing");
  };

  const handleAttendance = (type: "Masuk" | "Pulang") => {
    setIsLoadingLocation(true);
    setLocationText("Sedang mendapatkan lokasi...");
    
    if (!navigator.geolocation) {
      setIsLoadingLocation(false);
      setLocationText("GPS Tidak Didukung");
      showToast("Browser tidak mendukung GPS", "error");
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : '';
        if (!idToken) {
          showToast("Sesi login berakhir, silakan login ulang.", "error");
          setIsLoadingLocation(false);
          return;
        }

        if (type === "Masuk") {
          let checkinSuccess = false;

          // 1. Coba lewat API backend server terlebih dahulu
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            const res = await fetch("/api/attendance", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${idToken}`
              },
              body: JSON.stringify({ lat: latitude, lng: longitude }),
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            const resText = await res.text();
            let resData: any = null;
            try { resData = JSON.parse(resText); } catch {}

            if (res.ok && resData?.success) {
              checkinSuccess = true;
              setTimeCheckin(resData.timeCheckin);
              setHasCheckedIn(true);
              showToast(resData.message || "Berhasil Absen Masuk!", "success");

              localStorage.setItem("pilar_today_attendance", JSON.stringify({
                date: resData.tanggal,
                timeCheckin: resData.timeCheckin,
                timeCheckout: null,
                docId: resData.docId
              }));
              setIsLoadingLocation(false);
              return;
            } else if (resData?.error) {
              showToast(resData.error, "error");
              setIsLoadingLocation(false);
              return;
            }
          } catch (apiErr) {
            console.warn("API attendance notice, mencoba fallback Firestore langsung:", apiErr);
          }

          // 2. Fallback: Catat langsung ke Firestore jika API serverless Vercel mengalami latency / timeout
          if (!checkinSuccess) {
            try {
              const { fetchLocations, recordCheckIn, getTodayAttendance } = await import("@/lib/db");
              const locations = (await fetchLocations()) as any[];

              if (locations && locations.length > 0) {
                let eligible: any[] = locations;
                if (currentUser?.lokasiId && currentUser?.lokasiId !== 'all') {
                  const assigned = locations.filter((l: any) => l.id === currentUser.lokasiId);
                  if (assigned.length > 0) eligible = assigned;
                }

                // Rumus jarak Haversine (meter)
                const calcDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                  const R = 6371e3;
                  const toRad = (deg: number) => (deg * Math.PI) / 180;
                  const dLat = toRad(lat2 - lat1);
                  const dLon = toRad(lon2 - lon1);
                  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                };

                let minDistance = Infinity;
                let closest: any = eligible[0];
                for (const loc of eligible) {
                  if (typeof loc?.lat === 'number' && typeof loc?.lng === 'number') {
                    const dist = calcDist(latitude, longitude, loc.lat, loc.lng);
                    if (dist < minDistance) {
                      minDistance = dist;
                      closest = loc;
                    }
                  }
                }

                const allowedRadius = closest?.radius || 50;
                if (minDistance > allowedRadius) {
                  showToast(`Anda berada di luar radius kantor (${Math.round(minDistance)}m dari ${closest?.nama || 'Kantor'}, batas radius ${allowedRadius}m). Absensi masuk ditolak.`, "error");
                  setIsLoadingLocation(false);
                  return;
                }
              }

              // Cek apakah sudah absen masuk hari ini
              const todayAtt = await getTodayAttendance(currentUser?.id || auth.currentUser?.uid || '');
              if (todayAtt?.jamMasuk) {
                setTimeCheckin(todayAtt.jamMasuk);
                setHasCheckedIn(true);
                showToast("Anda sudah melakukan absen masuk hari ini.", "success");
                setIsLoadingLocation(false);
                return;
              }

              const now = new Date();
              const timeStr = now.toLocaleTimeString("id-ID", { timeZone: appTimezone, hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');
              const d = now.getDate();
              const m = now.getMonth() + 1;
              const y = now.getFullYear();
              const dateStr = `${d}/${m}/${y}`;

              const batasShift = currentUser?.shiftMasuk || "08:00";
              const isLate = timeStr > batasShift;
              const attStatus = isLate ? "Terlambat" : "Hadir";

              const docId = await recordCheckIn({
                karyawanId: currentUser?.id || auth.currentUser?.uid,
                karyawanNama: currentUser?.nama || "Karyawan",
                tanggal: dateStr,
                jamMasuk: timeStr,
                jamKeluar: null,
                status: attStatus,
                koordinatMasuk: { lat: latitude, lng: longitude }
              });

              if (docId) {
                setTimeCheckin(timeStr);
                setHasCheckedIn(true);
                showToast(isLate ? `Absen masuk berhasil (Terlambat: ${timeStr} ${appTimezoneCode})` : `Absen masuk berhasil (${timeStr} ${appTimezoneCode})`, "success");
                localStorage.setItem("pilar_today_attendance", JSON.stringify({
                  date: dateStr,
                  timeCheckin: timeStr,
                  timeCheckout: null,
                  docId: docId
                }));
              } else {
                showToast("Gagal menyimpan data absensi masuk.", "error");
              }
            } catch (fallbackErr) {
              console.error("Fallback checkin error:", fallbackErr);
              showToast("Gagal memproses absensi masuk.", "error");
            }
          }

        } else if (type === "Pulang" && hasCheckedIn) {
          const savedAtt = localStorage.getItem("pilar_today_attendance");
          let targetDocId = null;
          if (savedAtt) {
            try {
              targetDocId = JSON.parse(savedAtt).docId;
            } catch (e) {}
          }

          let checkoutSuccess = false;

          // 1. Coba lewat API backend
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            const res = await fetch("/api/attendance", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${idToken}`
              },
              body: JSON.stringify({ lat: latitude, lng: longitude, docId: targetDocId }),
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            const resText = await res.text();
            let resData: any = null;
            try { resData = JSON.parse(resText); } catch {}

            if (res.ok && resData?.success) {
              checkoutSuccess = true;
              setTimeCheckout(resData.timeCheckout);
              showToast(resData.message || "Berhasil Absen Pulang!", "success");

              let data: any = {
                date: resData.tanggal,
                timeCheckin: timeCheckin,
                timeCheckout: resData.timeCheckout,
                docId: resData.docId || targetDocId
              };
              localStorage.setItem("pilar_today_attendance", JSON.stringify(data));
              setIsLoadingLocation(false);
              return;
            } else if (resData?.error) {
              showToast(resData.error, "error");
              setIsLoadingLocation(false);
              return;
            }
          } catch (apiErr) {
            console.warn("API checkout notice, mencoba fallback Firestore:", apiErr);
          }

          // 2. Fallback: Langsung update ke Firestore
          if (!checkoutSuccess) {
            try {
              const now = new Date();
              const timeStr = now.toLocaleTimeString("id-ID", { timeZone: appTimezone, hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');
              const batasKeluar = currentUser?.shiftKeluar || "17:00";

              if (timeStr < batasKeluar) {
                showToast(`Belum masuk waktu pulang (Jadwal pulang shift Anda: ${batasKeluar}, jam saat ini: ${timeStr} ${appTimezoneCode}).`, "error");
                setIsLoadingLocation(false);
                return;
              }

              const { recordCheckOut } = await import("@/lib/db");
              if (targetDocId) {
                const ok = await recordCheckOut(targetDocId, timeStr, { lat: latitude, lng: longitude });
                if (ok) {
                  setTimeCheckout(timeStr);
                  showToast(`Berhasil absen pulang pada pukul ${timeStr} ${appTimezoneCode}`, "success");
                  let data: any = {
                    date: `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`,
                    timeCheckin: timeCheckin,
                    timeCheckout: timeStr,
                    docId: targetDocId
                  };
                  localStorage.setItem("pilar_today_attendance", JSON.stringify(data));
                } else {
                  showToast("Gagal memperbarui jam pulang ke database.", "error");
                }
              }
            } catch (fallbackErr) {
              console.error("Fallback checkout error:", fallbackErr);
              showToast("Gagal terhubung ke server absensi.", "error");
            }
          }
        }
        
        setLocationText(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        setIsLoadingLocation(false);
      },
      (error) => {
        setIsLoadingLocation(false);
        setLocationText("Akses GPS Ditolak");
        showToast("Wajib menyalakan lokasi GPS untuk Absen!", "error");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  if (isAuthChecking) {
    return (
      <div className="mobile-container flex flex-col items-center justify-center text-pilar-textPrimary mx-auto shadow-2xl relative overflow-hidden bg-pilar-darker select-none">
        {/* Decorative Glow */}
        <div className="absolute top-[-10%] left-[-20%] w-64 h-64 bg-pilar-gold/15 rounded-full blur-[80px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-20%] w-64 h-64 bg-blue-600/15 rounded-full blur-[80px] pointer-events-none"></div>

        <div className="flex flex-col items-center z-10 px-6 text-center animate-fade-in">
          {/* Logo with pulsing glow */}
          <div className="relative mb-5">
            <div className="absolute inset-0 bg-pilar-gold/30 rounded-3xl blur-xl animate-pulse"></div>
            <div className="w-20 h-20 rounded-3xl overflow-hidden shadow-2xl border-2 border-pilar-gold/50 bg-pilar-darker relative">
              <img src="/icon-512.png" alt="PilarAPP" className="w-full h-full object-cover" />
            </div>
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight">
            Pilar<span className="text-pilar-gold">APP</span>
          </h1>
          <p className="text-[11px] text-gray-400 font-semibold tracking-wider uppercase mt-1">
            PT. Pilar Sentra Solusi
          </p>

          {/* Session check status badge */}
          <div className="mt-8 flex flex-col items-center space-y-2.5">
            <div className="flex items-center space-x-2.5 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-gray-300 shadow-inner">
              <div className="w-3.5 h-3.5 border-2 border-pilar-gold/30 border-t-pilar-gold rounded-full animate-spin"></div>
              <span>Memeriksa sesi karyawan...</span>
            </div>
            <div className="w-36 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-transparent via-pilar-gold to-transparent w-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-container flex flex-col text-pilar-textPrimary mx-auto shadow-2xl relative overflow-hidden bg-pilar-dark">
      {/* Header Profile */}
      <header className="pt-10 pb-6 px-6 bg-pilar-darker rounded-b-3xl shadow-md z-10 relative">
        <div className="flex justify-between items-center">
          <div className="flex flex-col items-start">
            <div className="text-2xl font-bold font-heading text-pilar-gold drop-shadow-md leading-none flex items-baseline gap-1.5">
              <span>{currentTime}</span>
              <span className="text-[11px] font-black text-pilar-gold px-1.5 py-0.5 rounded bg-white/10 border border-white/10">{appTimezoneCode}</span>
            </div>
            <div className="text-xs text-pilar-textSecondary font-medium mt-1">
              {currentDate}
            </div>
          </div>
          <NotificationBell />
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto scrollable-content px-6 pt-6 pb-24 animate-slide-up relative">
        
        <div className="text-center mb-6">
          <h1 className="text-sm text-pilar-textSecondary uppercase tracking-wider">
            Selamat Datang,
          </h1>
          <h2 className="text-2xl font-bold font-heading text-pilar-textPrimary mt-1">
            {currentUser ? currentUser.nama : "Memuat..."}
          </h2>
        </div>

        <div className="mb-6"></div>

        {/* Attendance Action Buttons */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-8 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-pilar-gold/10 rounded-full blur-2xl"></div>

          <h3 className="text-center text-sm font-semibold mb-6 text-pilar-textSecondary uppercase tracking-wider">
            Status Hari Ini
          </h3>

          <div className="flex justify-between items-center space-x-4">
            {/* Check In Button */}
            <div className="flex-1 flex flex-col items-center">
              <button
                onClick={() => handleAttendance("Masuk")}
                disabled={hasCheckedIn || isLoadingLocation || isInitializingAttendance}
                className={`w-20 h-20 rounded-full flex flex-col items-center justify-center transition-transform relative ${
                  !hasCheckedIn && !isLoadingLocation && !isInitializingAttendance
                    ? "bg-pilar-gold text-pilar-darker shadow-neon animate-pulse-gold hover:scale-105 active:scale-95"
                    : "bg-gray-700 text-pilar-textSecondary opacity-50"
                }`}
              >
                {(isLoadingLocation || isInitializingAttendance) && !hasCheckedIn ? (
                  <i className="fa-solid fa-spinner fa-spin text-2xl"></i>
                ) : (
                  <>
                    <i className="fa-solid fa-sign-in-alt text-2xl mb-1"></i>
                    <span className="text-[10px] font-bold">MASUK</span>
                  </>
                )}
              </button>
              <span className="text-xs mt-3 text-pilar-textSecondary">
                {timeCheckin}
              </span>
            </div>

            <div className="w-px h-16 bg-white/10"></div>

            {/* Check Out Button */}
            <div className="flex-1 flex flex-col items-center">
              <button
                onClick={() => handleAttendance("Pulang")}
                disabled={!hasCheckedIn || timeCheckout !== "--:--" || isLoadingLocation || isInitializingAttendance}
                className={`w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all ${
                  hasCheckedIn && timeCheckout === "--:--" && !isLoadingLocation && !isInitializingAttendance
                    ? "bg-pilar-gold text-pilar-darker shadow-neon animate-pulse-gold hover:scale-105 active:scale-95"
                    : "bg-gray-700 text-pilar-textSecondary opacity-50 disabled:opacity-50"
                }`}
              >
                {isLoadingLocation && hasCheckedIn ? (
                  <i className="fa-solid fa-spinner fa-spin text-2xl"></i>
                ) : (
                  <>
                    <i className="fa-solid fa-sign-out-alt text-2xl mb-1"></i>
                    <span className="text-[10px] font-bold">PULANG</span>
                  </>
                )}
              </button>
              <span className="text-xs mt-3 text-pilar-textSecondary">
                {timeCheckout}
              </span>
            </div>
          </div>

          {/* Location Info */}
          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-center text-xs text-pilar-textSecondary">
            <i className={`fa-solid fa-location-dot ${locationText.includes("Akses GPS Ditolak") ? "text-red-500" : "text-pilar-gold"} mr-2`}></i>
            <span className="truncate">{locationText}</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white/5 rounded-xl p-3 flex flex-col items-center justify-center border border-white/5">
            <span className="text-pilar-gold font-bold text-lg mb-1">{stats.hadir}</span>
            <span className="text-[10px] text-pilar-textSecondary uppercase text-center">
              Hadir
            </span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 flex flex-col items-center justify-center border border-white/5">
            <span className="text-pilar-textPrimary font-bold text-lg mb-1">{stats.izin}</span>
            <span className="text-[10px] text-pilar-textSecondary uppercase text-center">
              Izin
            </span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 flex flex-col items-center justify-center border border-white/5">
            <span className="text-red-400 font-bold text-lg mb-1">{stats.absen}</span>
            <span className="text-[10px] text-pilar-textSecondary uppercase text-center">
              Absen
            </span>
          </div>
        </div>

        {/* Reset Testing Button */}
        <div className="mb-6 flex justify-center">
          <button 
            onClick={handleResetTesting}
            className="text-xs bg-red-500/10 text-red-400 py-2 px-4 rounded-full border border-red-500/20 hover:bg-red-500/20 transition-colors"
          >
            <i className="fa-solid fa-rotate-left mr-2"></i>
            Reset Absen (Mode Testing)
          </button>
        </div>

      </main>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 w-full bg-pilar-darker border-t border-white/10 px-6 py-4 flex justify-between items-center z-20">
        <Link href="/" className="flex flex-col items-center text-pilar-gold">
          <i className="fa-solid fa-house text-xl mb-1"></i>
          <span className="text-[10px] font-medium">Beranda</span>
        </Link>
        <Link href="/riwayat" className="flex flex-col items-center text-pilar-textSecondary hover:text-pilar-textPrimary transition-colors">
          <i className="fa-solid fa-clock-rotate-left text-xl mb-1"></i>
          <span className="text-[10px] font-medium">Riwayat</span>
        </Link>
        <Link href="/pengajuan" className="flex flex-col items-center text-pilar-textSecondary hover:text-pilar-textPrimary transition-colors">
          <i className="fa-solid fa-file-invoice text-xl mb-1"></i>
          <span className="text-[10px] font-medium">Pengajuan</span>
        </Link>
        <Link href="/gaji" className="flex flex-col items-center text-pilar-textSecondary hover:text-pilar-textPrimary transition-colors">
          <i className="fa-solid fa-sack-dollar text-xl mb-1"></i>
          <span className="text-[10px] font-medium">Gaji</span>
        </Link>
        <Link href="/pengaturan" className="flex flex-col items-center text-pilar-textSecondary hover:text-pilar-textPrimary transition-colors">
          <i className="fa-solid fa-cog text-xl mb-1"></i>
          <span className="text-[10px] font-medium">Pengaturan</span>
        </Link>
      </nav>

      {/* Toast Notification Container */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-11/12 max-w-sm z-50 flex flex-col gap-2 pointer-events-auto">
        {toasts.map((toast) => (
          <Toast 
            key={toast.id} 
            type={toast.type} 
            description={toast.message} 
            onClose={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))} 
          />
        ))}
      </div>
    </div>
  );
}
