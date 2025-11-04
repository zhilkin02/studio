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
