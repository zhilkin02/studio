import { initializeApp, getApps, getApp, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './config';

// This is a server-only file.

// IMPORTANT: The following is a placeholder for service account credentials.
// In a real production environment, this should be handled securely,
// for example, via environment variables or a secret manager.
// For this environment, we will use a simplified check.

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : null;

/**
 * Initializes the Firebase Admin SDK on the server.
 * Ensures that initialization happens only once (singleton pattern).
 *
 * @returns An object containing the initialized Firebase Admin App and Firestore instances.
 */
export function initializeServerApp() {
  if (getApps().length > 0) {
    const app = getApp();
    const firestore = getFirestore(app);
    return { app, firestore };
  }
  
  // If service account is available (e.g., in a secure server environment), use it.
  // Otherwise, initialize with the public config for basic server-side operations
  // that don't require admin privileges.
  const app = initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : undefined,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
  });

  const firestore = getFirestore(app);

  return { app, firestore };
}
