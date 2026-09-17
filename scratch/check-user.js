const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

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
  const auth = getAuth();
  const db = getFirestore();

  try {
    const user = await auth.getUserByEmail('admin@pt-pilar.co.id');
    console.log('User Auth:', {
      uid: user.uid,
      email: user.email,
      disabled: user.disabled,
      customClaims: user.customClaims,
      passwordHash: user.passwordHash ? 'EXISTS' : 'NONE'
    });

    const doc = await db.collection('admins').doc(user.uid).get();
    console.log('Firestore Doc exists?', doc.exists, doc.data());
  } catch (e) {
    console.error('Error getting user:', e);
  }
}
run();
