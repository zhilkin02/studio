'use client';

import {
  doc,
  runTransaction,
  deleteDoc,
  getDoc,
  DocumentReference,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';

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
export async function approveVideo(firestore: any, video: VideoFragment) {
  const pendingDocRef = doc(firestore, 'pendingVideoFragments', video.id);
  const approvedDocRef = doc(firestore, 'videoFragments', video.id);

  try {
    await runTransaction(firestore, async (transaction) => {
      const pendingDoc = await transaction.get(pendingDocRef);
      if (!pendingDoc.exists()) {
        throw new Error("Документ не найден в ожидающих!");
      }

      const newData = { ...pendingDoc.data(), status: 'approved' };
      transaction.set(approvedDocRef, newData);
      transaction.delete(pendingDocRef);
    });
    console.log('Видео успешно одобрено:', video.id);
  } catch (error) {
    console.error('Ошибка при одобрении видео:', error);
    // Здесь можно использовать useToast для вывода ошибки
  }
}

/**
 * Отклоняет видеофрагмент.
 * Удаляет документ из 'pendingVideoFragments'.
 * @param firestore - Экземпляр Firestore.
 * @param video - Объект видео для отклонения.
 */
export async function rejectVideo(firestore: any, video: VideoFragment) {
  const pendingDocRef = doc(firestore, 'pendingVideoFragments', video.id);

  try {
    await deleteDoc(pendingDocRef);
    console.log('Видео успешно отклонено:', video.id);
    // TODO: Удалить файл из Firebase Storage
  } catch (error) {
    console.error('Ошибка при отклонении видео:', error);
    // Здесь можно использовать useToast для вывода ошибки
  }
}
