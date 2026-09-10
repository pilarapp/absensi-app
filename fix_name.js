const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2].replace(/(^"|"$)/g, '').replace(/\\n/g, '\n');
  }
});

const privateKey = (env.FIREBASE_PRIVATE_KEY || env.GOOGLE_PRIVATE_KEY);
const clientEmail = env.FIREBASE_CLIENT_EMAIL || env.GOOGLE_CLIENT_EMAIL;

initializeApp({
  credential: cert({
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: clientEmail,
    privateKey: privateKey,
  })
});

const db = getFirestore();

async function run() {
  const uid = "NBDi75r4j8eikey3LIeFLtlp85D2";
  await db.collection("employees").doc(uid).set({
    nama: "Sahrul Azham",
    noInduk: "PLR-2023-089",
    divisi: "Teknologi Informasi",
    posisi: "IT Support"
  }, { merge: true });
  console.log("Updated!");
}
run();
