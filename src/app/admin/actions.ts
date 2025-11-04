'use client';

import {
  doc,
  runTransaction,
  deleteDoc,
  Firestore,
  DocumentData,
  getDoc
} from 'firebase/firestore';

// Определяем тип данных для фрагмента видео
interface VideoFragment {
  id: string;
  title: string;
  description: string;
  filePath: string;
  uploaderId: string;
  uploadDate: any;
  status: string;
}

/**
 * Одобряет видеофрагмент.
 * Перемещает документ из 'pendingVideoFragments' в 'videoFragments'.
 * @param firestore - Экземпляр Firestore.
 * @param videoId - ID видео для одобрения.
 */
export async function approveVideo(firestore: Firestore, videoId: string) {
  const pendingDocRef = doc(firestore, 'pendingVideoFragments', videoId);
  const approvedDocRef = doc(firestore, 'videoFragments', videoId);

  await runTransaction(firestore, async (transaction) => {
    const pendingDoc = await transaction.get(pendingDocRef);
    if (!pendingDoc.exists()) {
      throw new Error("Документ не найден в ожидающих!");
    }

    const newData = { ...pendingDoc.data(), status: 'approved' } as DocumentData;
    transaction.set(approvedDocRef, newData);
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
