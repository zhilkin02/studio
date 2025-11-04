'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  const isDev = process.env.NODE_ENV === 'development';
  if (getApps().length) {
    const app = getApp();
    return getSdks(app, isDev);
  }

  const firebaseApp = initializeApp(firebaseConfig);
  return getSdks(firebaseApp, isDev);
}

function getSdks(firebaseApp: FirebaseApp, isDev: boolean) {
  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);
  
  if (isDev && typeof window !== 'undefined') {
    // Используем свойство emulatorConfig, чтобы надежно проверить, было ли уже установлено соединение.
    // Это предотвращает ошибки при горячей перезагрузке Next.js (HMR).
    // @ts-ignore
    if (!auth.emulatorConfig) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
    // @ts-ignore
    if (!firestore.emulatorConfig) {
       connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
    }
  }

  return {
    firebaseApp,
    auth,
    firestore
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
