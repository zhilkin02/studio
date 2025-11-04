'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  onSnapshot,
  getDocs,
  DocumentData,
  Query,
  Unsubscribe,
  FirestoreError,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

type UseCollectionOptions = {
  listen?: boolean;
};

// Memoize the query to prevent re-renders
export function useMemoizedQuery(queryString: string | Query) {
  return useMemo(() => {
    return typeof queryString === 'string'
      ? (db: any) => query(collection(db, queryString))
      : queryString;
  }, [queryString]);
}

export function useCollection(
  targetRefOrQuery: Query | null,
  options: UseCollectionOptions = { listen: true }
) {
  const [data, setData] = useState<DocumentData[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const { listen } = options;

  useEffect(() => {
    if (!targetRefOrQuery) {
      // If the query is not ready (e.g., waiting for firestore instance), do nothing.
      setLoading(false);
      return;
    }
    setLoading(true);

    let unsubscribe: Unsubscribe = () => {};

    if (listen) {
      unsubscribe = onSnapshot(
        targetRefOrQuery,
        (snapshot) => {
          const docs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setData(docs);
          setLoading(false);
          setError(null);
        },
        (err) => {
          const path = (targetRefOrQuery as any)._query.path.canonicalString();
          const contextualError = new FirestorePermissionError({
            operation: 'list',
            path,
          });
          errorEmitter.emit('permission-error', contextualError);
          setError(err);
          setLoading(false);
        }
      );
    } else {
      getDocs(targetRefOrQuery)
        .then((snapshot) => {
          const docs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setData(docs);
          setLoading(false);
          setError(null);
        })
        .catch((err) => {
          const path = (targetRefOrQuery as any)._query.path.canonicalString();
           const contextualError = new FirestorePermissionError({
            operation: 'list',
            path,
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
  }, [targetRefOrQuery, listen]); // Re-run effect if query or listen option changes

  return { data, loading, error };
}
