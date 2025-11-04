'use server'
 
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db, storage } from '@/lib/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
 
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin'
 
export async function login(prevState: { error: string | undefined } | null, formData: FormData) {
  const password = formData.get('password');
  if (password === ADMIN_PASSWORD) {
    const cookieStore = cookies()
    cookieStore.set('session', 'admin', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7, // One week
        path: '/',
    })
    revalidatePath('/')
    redirect('/')
  }
 
  return { error: 'Неверный пароль.' }
}

export async function logout() {
    const cookieStore = cookies()
    cookieStore.delete('session')
    revalidatePath('/')
    redirect('/')
}

export async function uploadVideo(prevState: { error?: string; successMessage?: string } | null, formData: FormData) {
    const cookieStore = cookies()
    const session = cookieStore.get('session')?.value
    const isAdmin = session === 'admin'

    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const video = formData.get('video') as File;

    if (!title || !description || !video || video.size === 0) {
        return { error: 'Все поля обязательны для заполнения.' }
    }

    try {
        // 1. Upload video to Firebase Storage
        const videoRef = ref(storage, `videos/${Date.now()}_${video.name}`);
        const snapshot = await uploadBytes(videoRef, video);
        const downloadURL = await getDownloadURL(snapshot.ref);

        // 2. Save video metadata to Firestore
        const videoData = {
            title,
            description,
            downloadURL,
            storagePath: snapshot.ref.fullPath,
            status: isAdmin ? 'approved' : 'pending',
            createdAt: serverTimestamp(),
            uploader: isAdmin ? 'admin' : 'user',
        };

        await addDoc(collection(db, 'videos'), videoData);

        revalidatePath('/upload');

        if (isAdmin) {
            return { successMessage: 'Видео успешно загружено и опубликовано.' };
        } else {
            return { successMessage: 'Видео отправлено на модерацию. Спасибо!' };
        }

    } catch (e: any) {
        console.error("Error uploading video: ", e);
        return { error: `Ошибка при загрузке видео: ${e.message}` };
    }
}
