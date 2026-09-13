import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

function formatPrivateKey(key?: string) {
  if (!key) return undefined;
  // Hapus kutip di awal dan akhir jika tidak sengaja ter-copy di Vercel
  let cleanKey = key.trim().replace(/^["']|["']$/g, '');
  // Konversi literal \n menjadi newline asli
  cleanKey = cleanKey.replace(/\\n/g, '\n');
  return cleanKey;
}

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
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

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

// Proxy wrapper agar getAuth() & getFirestore() hanya dipanggil saat rute API dieksekusi,
// sehingga tidak menyebabkan crash fatal saat module load di serverless Vercel jika env belum lengkap.
export const adminAuth = new Proxy({} as Auth, {
  get(_, prop: string) {
    const app = getAdminApp();
    const auth = getAuth(app);
    const value = (auth as any)[prop];
    return typeof value === "function" ? value.bind(auth) : value;
  }
});

export const adminDb = new Proxy({} as Firestore, {
  get(_, prop: string) {
    const app = getAdminApp();
    const db = getFirestore(app);
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch (e) {}
    const value = (db as any)[prop];
    return typeof value === "function" ? value.bind(db) : value;
  }
});

