import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const email = (decodedToken.email || '').toLowerCase();

    // Check in 'admins' collection
    const adminDoc = await adminDb.collection('admins').doc(uid).get();
    const isAdmin = adminDoc.exists || decodedToken.role === 'admin';

    // Check in 'employees' collection
    const empDoc = await adminDb.collection('employees').doc(uid).get();
    let isEmployee = empDoc.exists;
    let employeeData = isEmployee ? empDoc.data() : null;

    // Fallback search in employees by email if doc ID was different
    if (!isEmployee && email) {
      const empQuery = await adminDb.collection('employees').where('email', '==', email).limit(1).get();
      if (!empQuery.empty) {
        isEmployee = true;
        employeeData = empQuery.docs[0].data();
      }
    }

    return NextResponse.json({
      success: true,
      uid,
      email,
      isAdmin,
      isEmployee,
      employeeStatus: employeeData?.status || null,
      role: isAdmin ? 'admin' : (isEmployee ? 'karyawan' : 'unknown')
    });
  } catch (error: any) {
    console.error('Verify role error:', error);
    return NextResponse.json({ error: error.message || 'Token verification failed' }, { status: 401 });
  }
}
