import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

let adminApp: App | undefined;

function getAdminApp(): App {
  if (adminApp) {
    return adminApp;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  // Check if we have admin credentials
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  } else {
    // Initialize without credentials for demo mode
    adminApp = initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
    });
  }

  return adminApp;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getAdminApp());
}

export function getAdminStorage(): Storage {
  return getStorage(getAdminApp());
}

// Verify if a user has admin role via custom claims
export async function verifyAdmin(idToken: string): Promise<boolean> {
  try {
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    return decodedToken.admin === true;
  } catch {
    return false;
  }
}

// Set admin custom claim for a user
export async function setAdminClaim(uid: string, isAdmin: boolean): Promise<void> {
  await getAdminAuth().setCustomUserClaims(uid, { admin: isAdmin });
}

// Get user by email
export async function getUserByEmail(email: string) {
  try {
    return await getAdminAuth().getUserByEmail(email);
  } catch {
    return null;
  }
}
