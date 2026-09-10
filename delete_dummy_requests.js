const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length) {
    let val = value.join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    env[key.trim()] = val;
  }
});

const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

initializeApp({
  credential: cert({
    projectId,
    clientEmail,
    privateKey,
  }),
});

const db = getFirestore();

async function deleteDummyRequests() {
  try {
    const snapshot = await db.collection('requests').get();
    let count = 0;
    
    for (const doc of snapshot.docs) {
      // We assume all current requests are dummy data since this is a new app
      await doc.ref.delete();
      count++;
    }
    
    console.log(`Deleted ${count} dummy requests.`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

deleteDummyRequests();
