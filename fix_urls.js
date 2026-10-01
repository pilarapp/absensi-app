const { adminDb } = require('./src/lib/firebase-admin');

async function fixUrls() {
  console.log("Mencari URL lama di database...");
  const snapshot = await adminDb.collection('requests').get();
  
  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.lampiranUrl && data.lampiranUrl.startsWith('https://pub-2ebea01d20e4406287ae900adafe0102.r2.dev/')) {
      const newUrl = data.lampiranUrl.replace('https://pub-2ebea01d20e4406287ae900adafe0102.r2.dev/', '/storage/');
      await doc.ref.update({ lampiranUrl: newUrl });
      count++;
    }
  }
  
  console.log(`Berhasil memperbaiki ${count} dokumen!`);
  process.exit(0);
}

fixUrls().catch(console.error);
