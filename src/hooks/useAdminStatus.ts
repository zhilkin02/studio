'use client';

import { useMemo } from 'react';
import { doc } from 'firebase/firestore';
import { useFirestore, useUser, useDoc } from '@/firebase';

/**
 * A hook to securely check if the current user is an administrator.
 *
 * @returns {boolean} - True if the user is an admin, false otherwise.
 * It returns false while loading or if there's no user.
 */
export function useAdminStatus(): boolean {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  // Create a memoized reference to the user's admin role document.
  // This prevents re-renders and ensures the reference is stable.
  const adminDocRef = useMemo(() => {
    if (!user) return null;
    return doc(firestore, 'roles_admin', user.uid);
  }, [firestore, user]);

  // Use the useDoc hook to listen for the existence of this document.
  const { data: adminDoc, isLoading: isAdminLoading } = useDoc(adminDocRef);

  // The user is an admin if they are logged in, and the admin document exists.
  // We check that both user loading and admin doc loading are complete.
  const isAdmin = useMemo(() => {
    if (isUserLoading || isAdminLoading) {
      return false;
    }
    return !!user && !!adminDoc;
  }, [user, adminDoc, isUserLoading, isAdminLoading]);

  return isAdmin;
}
