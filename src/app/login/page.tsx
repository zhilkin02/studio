'use client';

import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirebase } from '@/firebase';

function GoogleIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M21.35 11.1h-9.1v2.9h5.2c-.2 1-1.2 2.8-3.1 2.8c-1.9 0-3.4-1.6-3.4-3.6s1.5-3.6 3.4-3.6c.9 0 1.6.4 2.1.8l2.2-2.1C16.9 5.5 15 4.5 12.25 4.5c-3.9 0-7 3.1-7 7s3.1 7 7 7c4.1 0 6.6-2.8 6.6-6.7c0-.5 0-1-.1-1.4z" />
        </svg>
    )
}

export default function LoginPage() {
  const { auth } = useFirebase();
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push('/profile');
    } catch (error) {
      console.error('Error signing in with Google:', error);
      // You might want to show a toast notification here
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-12rem)]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Вход в аккаунт</CardTitle>
          <CardDescription>
            Войдите, чтобы загружать свои видеофрагменты.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
          >
            <GoogleIcon />
            Войти через Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
