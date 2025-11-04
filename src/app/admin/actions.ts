'use client';

import {
  doc,
  runTransaction,
  deleteDoc,
  Firestore,
  DocumentData,
} from 'firebase/firestore';

/**
 * Одобряет видеофрагмент.
 * Копирует документ из 'pendingVideoFragments' в 'publicVideoFragments' и удаляет исходный.
 * @param firestore - Экземпляр Firestore.
 * @param videoId - ID видео для одобрения.
 */
export async function approveVideo(firestore: Firestore, videoId: string) {
  const pendingDocRef = doc(firestore, 'pendingVideoFragments', videoId);
  const approvedDocRef = doc(firestore, 'publicVideoFragments', videoId);
  const masterDocRef = doc(firestore, 'videoFragments', videoId);

  await runTransaction(firestore, async (transaction) => {
    const pendingDoc = await transaction.get(pendingDocRef);
    if (!pendingDoc.exists()) {
      throw new Error("Документ не найден в ожидающих!");
    }

    const newData = { ...pendingDoc.data(), status: 'approved' } as DocumentData;
    
    // Create a copy in the public collection and the master collection
    transaction.set(approvedDocRef, newData);
    transaction.set(masterDocRef, newData);

    // Delete the original from pending
    transaction.delete(pendingDocRef);
  });
}

/**
 * Отклоняет видеофрагмент.
 * Удаляет документ из 'pendingVideoFragments'.
 * @param firestore - Экземпляр Firestore.
 * @param videoId - ID видео для отклонения.
 */
export async function rejectVideo(firestore: Firestore, videoId: string) {
  const pendingDocRef = doc(firestore, 'pendingVideoFragments', videoId);
  await deleteDoc(pendingDocRef);
  // TODO: Удалить файл из Firebase Storage
}
