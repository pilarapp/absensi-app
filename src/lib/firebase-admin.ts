import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let cachedApp: App | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

export function formatPrivateKey(key?: string) {
  if (!key) return undefined;
  let cleanKey = key.trim();
  // Hapus kutip di awal dan akhir jika tidak sengaja ter-copy di Vercel
  if ((cleanKey.startsWith('"') && cleanKey.endsWith('"')) || (cleanKey.startsWith("'") && cleanKey.endsWith("'"))) {
    cleanKey = cleanKey.slice(1, -1).trim();
  }
  // Normalisasi carriage return (\r)
  cleanKey = cleanKey.replace(/\r/g, '');
  // Konversi literal \n menjadi newline asli
  cleanKey = cleanKey.replace(/\\n/g, '\n');
  return cleanKey;
}

export function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApps()[0];
    return cachedApp;
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY;
  const privateKey = formatPrivateKey(rawKey);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials belum lengkap. Pastikan NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, dan FIREBASE_PRIVATE_KEY sudah disetel di Vercel Environment Variables."
    );
  }

  cachedApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
  return cachedApp;
}

// Proxy wrapper agar getAuth() & getFirestore() hanya dipanggil saat rute API dieksekusi,
// sehingga tidak menyebabkan crash fatal saat module load di serverless Vercel jika env belum lengkap.
export const adminAuth = new Proxy({} as Auth, {
  get(_, prop: string) {
    if (!cachedAuth) {
      const app = getAdminApp();
      cachedAuth = getAuth(app);
    }
    const value = (cachedAuth as any)[prop];
    return typeof value === "function" ? value.bind(cachedAuth) : value;
  }
});

export const adminDb = new Proxy({} as Firestore, {
  get(_, prop: string) {
    if (!cachedDb) {
      const app = getAdminApp();
      cachedDb = getFirestore(app);
      try {
        cachedDb.settings({ ignoreUndefinedProperties: true });
      } catch (e) {}
    }
    const value = (cachedDb as any)[prop];
    return typeof value === "function" ? value.bind(cachedDb) : value;
  }
});


