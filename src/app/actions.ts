'use server'
 
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
 
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

export async function uploadVideo(prevState: { error?: string; success?: boolean } | null, formData: FormData) {
    const cookieStore = cookies()
    const session = cookieStore.get('session')?.value
    if (session !== 'admin') {
        return { error: 'У вас нет прав для выполнения этого действия.' }
    }

    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const video = formData.get('video') as File;

    if (!title || !description || !video || video.size === 0) {
        return { error: 'Все поля обязательны для заполнения.' }
    }

    // TODO: Implement actual file storage and database record creation
    console.log('Получено видео на модерацию:');
    console.log('Название:', title);
    console.log('Описание:', description);
    console.log('Файл:', video.name, `${(video.size / 1024 / 1024).toFixed(2)} MB`);

    // Simulate a successful upload
    revalidatePath('/upload');
    return { success: true };
}
