'use client';

import Link from 'next/link';
import { Film, User as UserIcon, LogIn, LogOut, Upload, Shield } from 'lucide-react';
import { useUser } from '@/firebase/auth/use-user';
import { getAuth, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemo } from 'react';
import { collection } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { EditableText } from '@/components/editable-text';


function AuthButtons() {
  const { user, loading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const pendingQuery = useMemo(() => {
    if (!firestore || !user?.isAdmin) return null;
    return collection(firestore, 'pendingVideoFragments');
  }, [firestore, user?.isAdmin]);

  const { data: pendingVideos } = useCollection(pendingQuery, { listen: true });
  const pendingCount = pendingVideos?.length ?? 0;


  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
    router.push('/');
  };

  if (loading) {
    return <div className="h-10 w-24 rounded-md animate-pulse bg-muted" />;
  }

  if (!user) {
    return (
      <Button asChild>
        <Link href="/login">
          <LogIn />
          Войти
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
       <Button asChild>
          <Link href="/upload">
            <Upload className="mr-2 h-4 w-4" />
            Загрузить видео
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
               <Avatar className="h-10 w-10">
                  <AvatarImage src={user.photoURL ?? ''} alt={user.displayName ?? 'User'} />
                  <AvatarFallback>
                    <UserIcon />
                  </AvatarFallback>
                </Avatar>
                 {user.isAdmin && pendingCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {pendingCount}
                    </Badge>
                )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.displayName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Профиль</span>
              </Link>
            </DropdownMenuItem>
            {user.isAdmin && (
               <DropdownMenuItem asChild>
                 <Link href="/admin" className="flex items-center justify-between w-full">
                    <div className="flex items-center">
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Панель администратора</span>
                    </div>
                     {pendingCount > 0 && (
                        <Badge variant="destructive" className="h-5">{pendingCount}</Badge>
                    )}
                 </Link>
               </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Выйти</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
    </div>
  );
}


export function Header() {
  return (
    <header className="bg-background border-b border-border/50 sticky top-0 z-40">
      <div className="container mx-auto px-4 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Film className="h-6 w-6 text-accent" />
          <EditableText
            docPath="site_content/main"
            fieldKey="header_title"
            defaultValue="КоНК"
            render={(text) => <span className="whitespace-pre-wrap">{text}</span>}
            textarea={true}
          />
        </Link>
        <div className="flex items-center gap-4">
          <AuthButtons />
        </div>
      </div>
    </header>
  );
}
