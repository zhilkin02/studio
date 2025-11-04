import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Film } from 'lucide-react';
import { cookies } from 'next/headers';
import { logout } from '@/app/actions';

export function Header() {
  const cookieStore = cookies();
  const session = cookieStore.get('session')?.value;
  const isAdmin = session === 'admin';

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
            <>
              <form action={logout}>
                <Button variant="ghost" type="submit">Выйти</Button>
              </form>
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
