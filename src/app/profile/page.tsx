'use client';

import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getAuth, signOut } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, Upload } from 'lucide-react';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


export default function ProfilePage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
    router.push('/');
  };

  if (loading || !user) {
    return (
        <div className="container mx-auto px-4 py-8">
            <Card className="max-w-2xl mx-auto">
                <CardHeader className="text-center">
                    <Skeleton className="w-24 h-24 rounded-full mx-auto" />
                    <Skeleton className="h-8 w-48 mx-auto mt-4" />
                    <Skeleton className="h-4 w-64 mx-auto mt-2" />
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <Skeleton className="h-10 w-32 mx-auto" />
                </CardContent>
            </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <Avatar className="w-24 h-24 mx-auto mb-4 border-2 border-primary">
            <AvatarImage src={user.photoURL ?? ''} />
            <AvatarFallback className="text-3xl">
              {user.displayName?.charAt(0) ?? 'U'}
            </AvatarFallback>
          </Avatar>
          <CardTitle className="text-3xl flex items-center justify-center gap-2">
            {user.displayName}
            {user.isAdmin && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Shield className="h-6 w-6 text-primary"/>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Администратор</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center space-y-4">
           <Button asChild>
            <Link href="/upload">
              <Upload className="mr-2 h-4 w-4" />
              Загрузить новое видео
            </Link>
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center">
            <Button onClick={handleLogout} variant="destructive">
                Выйти из аккаунта
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
