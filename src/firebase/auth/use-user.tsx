'use client';

import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '@/firebase/provider';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '../provider';

export interface UserProfile extends User {
  isAdmin?: boolean;
}

export function useUser() {
  const auth = useAuth();
  const firestore = useFirestore();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !firestore) {
      // Firebase might not be initialized yet.
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        // Check for admin role
        const adminRoleRef = doc(firestore, 'roles_admin', authUser.uid);
        const adminDoc = await getDoc(adminRoleRef);
        const isAdmin = adminDoc.exists();

        const userProfile: UserProfile = {
          ...authUser,
          isAdmin,
        };
        setUser(userProfile);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, firestore]);

  return { user, loading };
}
