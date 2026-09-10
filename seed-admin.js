const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const privateKey = (process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY)?.replace(/\\n/g, "\n");
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;

initializeApp({
  credential: cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: clientEmail,
    privateKey: privateKey,
  }),
});

const auth = getAuth();

async function seedAdmin() {
  try {
    const userRecord = await auth.createUser({
      email: 'admin@pt-pilar.co.id',
      password: 'password123',
      displayName: 'Super Admin',
    });
    console.log('Successfully created admin user:', userRecord.uid);
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      console.log('Admin user already exists. Updating password to password123...');
      const user = await auth.getUserByEmail('admin@pt-pilar.co.id');
      await auth.updateUser(user.uid, { password: 'password123' });
      console.log('Admin password updated successfully.');
    } else {
      console.error('Error creating admin user:', error);
    }
  }
}

seedAdmin();
