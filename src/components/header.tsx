"use client";

import Link from 'next/link';
import { Film } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-background border-b border-border/50 sticky top-0 z-40">
      <div className="container mx-auto px-4 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Film className="h-6 w-6 text-accent" />
          <span>КоНК</span>
        </Link>
        <div className="flex items-center gap-4">
          {/* Auth buttons removed */}
        </div>
      </div>
    </header>
  );
}
