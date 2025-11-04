import { initializeApp, getApps, getApp, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// This is a server-only file.

/**
 * Initializes the Firebase Admin SDK on the server.
 * Ensures that initialization happens only once (singleton pattern).
 * In a Google Cloud environment, initializeApp() automatically finds
 * the service account credentials.
 *
 * @returns An object containing the initialized Firebase Admin App and Firestore instances.
 */
export function initializeServerApp() {
  if (getApps().length > 0) {
    const app = getApp();
    const firestore = getFirestore(app);
    return { app, firestore };
  }
  
  // When running in a Google Cloud environment (like Cloud Workstations),
  // the SDK automatically discovers service account credentials.
  const app = initializeApp();

  const firestore = getFirestore(app);

  return { app, firestore };
}
