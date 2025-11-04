"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Film } from 'lucide-react';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export function Header() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  const isAdmin = user && user.email === 'konk-media-archive@gmail.com';

  return (
    <header className="bg-background border-b border-border/50 sticky top-0 z-40">
      <div className="container mx-auto px-4 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Film className="h-6 w-6 text-accent" />
          <span>КоНК</span>
        </Link>
        <div className="flex items-center gap-4">
          {isUserLoading ? (
            <div className="h-10 w-24 bg-muted rounded-md animate-pulse" />
          ) : user ? (
            <>
              {isAdmin && (
                 <Link href="/admin">
                    <Button variant="outline">Админ</Button>
                  </Link>
              )}
              <Link href="/upload">
                <Button variant="outline">Загрузить видео</Button>
              </Link>
              <Button variant="ghost" onClick={handleLogout}>Выйти</Button>
            </>
          ) : (
            <Link href="/login">
                <Button variant="ghost">Войти</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
