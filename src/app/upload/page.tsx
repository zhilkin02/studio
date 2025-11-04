'use client';

import { useUser } from '@/firebase';
import { UploadForm } from './upload-form';
import Link from 'next/link';

export default function UploadPage() {
  const { user, isUserLoading } = useUser();

  if (isUserLoading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 text-center">
        <p>Загрузка...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Доступ запрещен</h1>
        <p className="mb-4">
          Пожалуйста,{' '}
          <Link href="/login" className="underline text-accent">
            войдите в систему
          </Link>
          , чтобы загружать видео.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Загрузить новое видео</h1>
      <UploadForm />
    </div>
  );
}
