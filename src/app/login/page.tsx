"use client";

import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useAuth, useUser } from "@/firebase/provider";
import { Button } from "@/components/ui/button";
import { useEffect } from 'react';
import { Chrome } from 'lucide-react';

export default function LoginPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push('/');
    } catch (error) {
      console.error("Ошибка входа через Google:", error);
    }
  };

  if (isUserLoading || user) {
    return (
      <div className="flex justify-center items-center py-16">
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center py-16">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-3xl font-bold">Вход в систему</h1>
        <p className="text-muted-foreground">
          Войдите с помощью Google, чтобы продолжить.
        </p>
        <Button onClick={handleGoogleSignIn} className="w-full">
          <Chrome className="mr-2 h-5 w-5" />
          Войти через Google
        </Button>
      </div>
    </div>
  );
}
