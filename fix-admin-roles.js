const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length) {
    let val = value.join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[key.trim()] = val;
  }
});

initializeApp({
  credential: cert({
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  })
});

async function run() {
  const db = getFirestore();
  const auth = getAuth();
  const snap = await db.collection('admins').get();
  for (const doc of snap.docs) {
    const d = doc.data();
    console.log(d.email, '-> role:', d.role, 'nik:', d.nik, 'nama:', d.nama);
    if (d.email === 'pilarss@admin.com') {
      await db.collection('admins').doc(doc.id).update({ role: 'superadmin', nama: 'Super Admin PT. PILAR' });
      await auth.setCustomUserClaims(doc.id, { role: 'admin', isSuperAdmin: true });
      console.log('✅ Updated to superadmin:', d.email);
    }
  }
  process.exit(0);
}
run();
