'use client';

import {
  doc,
  runTransaction,
  deleteDoc,
  getDoc,
  DocumentReference,
  Firestore,
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
 * @param video - Объект видео для одобрения.
 */
export async function approveVideo(firestore: Firestore, video: VideoFragment) {
  const pendingDocRef = doc(firestore, 'pendingVideoFragments', video.id);
  const approvedDocRef = doc(firestore, 'videoFragments', video.id);

  await runTransaction(firestore, async (transaction) => {
    const pendingDoc = await transaction.get(pendingDocRef);
    if (!pendingDoc.exists()) {
      throw new Error("Документ не найден в ожидающих!");
    }

    const newData = { ...pendingDoc.data(), status: 'approved' };
    transaction.set(approvedDocRef, newData);
    transaction.delete(pendingDocRef);
  });
}

/**
 * Отклоняет видеофрагмент.
 * Удаляет документ из 'pendingVideoFragments'.
 * @param firestore - Экземпляр Firestore.
 * @param video - Объект видео для отклонения.
 */
export async function rejectVideo(firestore: Firestore, video: VideoFragment) {
  const pendingDocRef = doc(firestore, 'pendingVideoFragments', video.id);
  await deleteDoc(pendingDocRef);
  // TODO: Удалить файл из Firebase Storage
}
