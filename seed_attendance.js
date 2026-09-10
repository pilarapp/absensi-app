const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

// Load environment variables from .env
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

async function seedAttendance() {
  try {
    const records = [
      {
        karyawanId: "NBDi75r4j8eikey3LleFLtlp85D2",
        tanggal: "01/09/2026",
        jamMasuk: "07:45",
        jamKeluar: "17:05",
        status: "Hadir",
        keterangan: "-"
      },
      {
        karyawanId: "NBDi75r4j8eikey3LleFLtlp85D2",
        tanggal: "02/09/2026",
        jamMasuk: "07:50",
        jamKeluar: "17:00",
        status: "Hadir",
        keterangan: "-"
      },
      {
        karyawanId: "NBDi75r4j8eikey3LleFLtlp85D2",
        tanggal: "03/09/2026",
        jamMasuk: "08:30",
        jamKeluar: "17:10",
        status: "Hadir",
        keterangan: "Terlambat (Macet)"
      },
      {
        karyawanId: "NBDi75r4j8eikey3LleFLtlp85D2",
        tanggal: "04/09/2026",
        jamMasuk: "-",
        jamKeluar: "-",
        status: "Sakit",
        keterangan: "Demam"
      },
      {
        karyawanId: "NBDi75r4j8eikey3LleFLtlp85D2",
        tanggal: "05/09/2026",
        jamMasuk: "-",
        jamKeluar: "-",
        status: "Izin",
        keterangan: "Keperluan Keluarga"
      },
      {
        karyawanId: "NBDi75r4j8eikey3LleFLtlp85D2",
        tanggal: "06/09/2026",
        jamMasuk: "-",
        jamKeluar: "-",
        status: "Cuti",
        keterangan: "Cuti Tahunan"
      },
      {
        karyawanId: "PLR-2023-089",
        tanggal: "07/09/2026",
        jamMasuk: "08:45",
        jamKeluar: "17:00",
        status: "Hadir",
        keterangan: "Terlambat (Hujan)"
      }
    ];

    const batch = db.batch();
    const attendanceRef = db.collection('attendance');

    for (const record of records) {
      const docRef = attendanceRef.doc();
      batch.set(docRef, record);
    }

    await batch.commit();
    console.log("Seed data created successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
}

seedAttendance();
