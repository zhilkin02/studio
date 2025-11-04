"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Film } from 'lucide-react';
import { useEffect, useState } from 'react';

// Helper function to get cookie on the client
function getCookie(name: string): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
      return parts.pop()?.split(';').shift();
  }
  return undefined;
}


export function Header() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check cookie on mount and update state
    const session = getCookie('session');
    setIsAdmin(session === 'admin');
  }, []);

  const handleLogout = () => {
    // Clear session cookie
    document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    // Update state and refresh UI
    setIsAdmin(false);
    router.push('/');
    router.refresh();
  };

  return (
    <header className="bg-background border-b border-border/50 sticky top-0 z-40">
      <div className="container mx-auto px-4 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Film className="h-6 w-6 text-accent" />
          <span>КоНК</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/upload">
            <Button variant="outline">Загрузить видео</Button>
          </Link>
          {isAdmin ? (
            <Button variant="ghost" onClick={handleLogout}>Выйти</Button>
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
