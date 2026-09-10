const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
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
initializeApp({ credential: cert({ projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n') }) });
const db = getFirestore();
db.collection('employees').get().then(snap => {
  snap.docs.forEach(d => console.log("EMPLOYEE:", d.id, d.data().nama, d.data().email));
  process.exit(0);
});
