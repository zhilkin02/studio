'use client';

import { useAdminStatus } from '@/hooks/useAdminStatus';
import Link from 'next/link';
import { PendingVideos } from './pending-videos';

export default function AdminPage() {
  const isAdmin = useAdminStatus();

  if (!isAdmin) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Доступ запрещен</h1>
        <p>
          Эта страница доступна только администраторам. Пожалуйста,{' '}
          <Link href="/login" className="underline text-accent">
            войдите в систему
          </Link>{' '}
          с помощью аккаунта администратора.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Панель администратора</h1>
      <PendingVideos />
    </div>
  );
}
