const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
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

const auth = getAuth();
const db = getFirestore();

async function seedAdmins() {
  console.log("Checking current users...");
  const list = await auth.listUsers();
  
  // List of known admin emails
  const defaultAdminEmails = [
    'admin@pt-pilar.co.id',
    'pilar@gmail.com',
    'superadmin@pt-pilar.co.id',
  ];

  for (const u of list.users) {
    console.log(`Found Auth User: ${u.email} (${u.uid})`);
    // If email contains "admin" or is in defaultAdminEmails
    if (u.email && (u.email.includes('admin') || defaultAdminEmails.includes(u.email))) {
      await db.collection('admins').doc(u.uid).set({
        uid: u.uid,
        email: u.email,
        nama: u.displayName || 'Administrator',
        role: 'superadmin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      
      // Set custom claims as well for enterprise RBAC
      await auth.setCustomUserClaims(u.uid, { role: 'admin' });
      console.log(`✅ Registered as ADMIN: ${u.email} (${u.uid})`);
    }
  }

  // Ensure admin@pt-pilar.co.id exists
  try {
    let adminUser;
    try {
      adminUser = await auth.getUserByEmail('admin@pt-pilar.co.id');
    } catch {
      adminUser = await auth.createUser({
        email: 'admin@pt-pilar.co.id',
        password: 'password123',
        displayName: 'Super Admin',
      });
      console.log('Created new auth user: admin@pt-pilar.co.id');
    }

    await db.collection('admins').doc(adminUser.uid).set({
      uid: adminUser.uid,
      email: adminUser.email,
      nama: adminUser.displayName || 'Super Admin',
      role: 'superadmin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    await auth.setCustomUserClaims(adminUser.uid, { role: 'admin' });
    console.log(`✅ Ensured admin@pt-pilar.co.id in 'admins' collection and custom claims!`);
  } catch (err) {
    console.error("Error ensuring admin user:", err);
  }

  console.log("Seeding admins finished successfully.");
  process.exit(0);
}

seedAdmins().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
