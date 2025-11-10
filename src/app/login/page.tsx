'use client';

import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth, useFirestore } from '@/firebase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

function GoogleIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M21.35 11.1h-9.1v2.9h5.2c-.2 1-1.2 2.8-3.1 2.8c-1.9 0-3.4-1.6-3.4-3.6s1.5-3.6 3.4-3.6c.9 0 1.6.4 2.1.8l2.2-2.1C16.9 5.5 15 4.5 12.25 4.5c-3.9 0-7 3.1-7 7s3.1 7 7 7c4.1 0 6.6-2.8 6.6-6.7c0-.5 0-1-.1-1.4z" />
        </svg>
    )
}

// Function to create user profile if it doesn't exist
const createUserProfile = async (firestore: any, user: User) => {
    const userRef = doc(firestore, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        const { uid, email, displayName, photoURL } = user;
        try {
            await setDoc(userRef, {
                id: uid,
                email,
                displayName,
                photoURL,
                registrationDate: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error creating user profile:", error);
            // We can decide if we want to bubble this error up to the user
        }
    }
};

export default function LoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = () => {
    if (!auth || !firestore) {
        setError("Сервис аутентификации или база данных еще не инициализированы.");
        return;
    };
    setError(null);
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
      .then(async (result) => {
        // Create user profile document on first sign in
        await createUserProfile(firestore, result.user);
        router.push('/profile');
      })
      .catch((error: any) => {
        console.error('Error signing in with Google:', error);
        setError(`Ошибка входа: ${error.code} - ${error.message}`);
      });
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
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Ошибка аутентификации</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={!auth}
          >
            <GoogleIcon />
            Войти через Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
