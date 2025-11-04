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

export function getSdks(firebaseApp: FirebaseApp, isDev: boolean) {
  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);
  
  if (isDev && typeof window !== 'undefined' && !(auth as any).emulatorConfig) {
    // В рабочей среде Next.js HMR может вызывать это несколько раз. 
    // Проверяем, был ли эмулятор уже подключен.
    try {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
    } catch (e) {
      // Игнорируем ошибки, если эмуляторы уже подключены.
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