require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  });
}

const db = admin.firestore();

async function fixUrls() {
  console.log("Mencari URL lama di database...");
  const snapshot = await db.collection('requests').get();
  
  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.lampiranUrl && data.lampiranUrl.startsWith('https://pub-2ebea01d20e4406287ae900adafe0102.r2.dev/')) {
      const newUrl = data.lampiranUrl.replace('https://pub-2ebea01d20e4406287ae900adafe0102.r2.dev/', '/storage/');
      await doc.ref.update({ lampiranUrl: newUrl });
      count++;
      console.log(`Updated doc ${doc.id}`);
    }
  }
  
  console.log(`Berhasil memperbaiki ${count} dokumen!`);
  process.exit(0);
}

fixUrls().catch(console.error);
