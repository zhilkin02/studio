'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  doc,
  onSnapshot,
  getDoc,
  DocumentData,
  DocumentReference,
  Unsubscribe,
  FirestoreError,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

type UseDocOptions = {
  listen?: boolean;
};

export function useDoc(
  targetRef: DocumentReference | null,
  options: UseDocOptions = { listen: true }
) {
  const [data, setData] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const { listen } = options;

  useEffect(() => {
    if (!targetRef) {
      setLoading(false);
      return;
    }
    setLoading(true);

    let unsubscribe: Unsubscribe = () => {};

    if (listen) {
      unsubscribe = onSnapshot(
        targetRef,
        (docSnapshot) => {
          if (docSnapshot.exists()) {
            setData({ id: docSnapshot.id, ...docSnapshot.data() });
          } else {
            setData(null);
          }
          setLoading(false);
          setError(null);
        },
        (err) => {
          const contextualError = new FirestorePermissionError({
            operation: 'get',
            path: targetRef.path,
          });
          errorEmitter.emit('permission-error', contextualError);
          setError(err);
          setLoading(false);
        }
      );
    } else {
      getDoc(targetRef)
        .then((docSnapshot) => {
          if (docSnapshot.exists()) {
            setData({ id: docSnapshot.id, ...docSnapshot.data() });
          } else {
            setData(null);
          }
          setLoading(false);
          setError(null);
        })
        .catch((err) => {
           const contextualError = new FirestorePermissionError({
            operation: 'get',
            path: targetRef.path,
          });
          errorEmitter.emit('permission-error', contextualError);
          setError(err);
          setLoading(false);
        });
    }

    return () => {
      if (listen) {
        unsubscribe();
      }
    };
  }, [targetRef, listen]);

  return { data, loading, error };
}
