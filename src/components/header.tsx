import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Film } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-background border-b sticky top-0 z-40">
      <div className="container mx-auto px-4 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Film className="h-6 w-6 text-primary" />
          <span>КоНК</span>
        </Link>
        <div className="flex items-center gap-4">
          <Button variant="ghost">Войти</Button>
          <Button>Загрузить видео</Button>
        </div>
      </div>
    </header>
  );
}
