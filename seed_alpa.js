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

initializeApp({ 
  credential: cert({ 
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 
    clientEmail: env.FIREBASE_CLIENT_EMAIL, 
    privateKey: (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n') 
  }) 
});

const db = getFirestore();

async function seed() {
  const empId = "NBDi75r4j8eikey3LleFLtlp85D2";
  const empName = "Diar Hanif";
  
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  
  const dates = [
    `${year}-${month}-01`,
    `${year}-${month}-02`,
    `${year}-${month}-03`,
  ];
  
  for (let date of dates) {
    await db.collection("attendance").add({
      karyawanId: empId,
      karyawanNama: empName,
      tanggal: date,
      status: "Alpa",
      createdAt: new Date(`${date}T09:00:00`).toISOString()
    });
    console.log("Seeded Alpa for", date);
  }
  
  console.log("Done seeding Alpa records!");
  process.exit(0);
}

seed();
