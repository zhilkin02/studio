'use client';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function UploadPage() {
    const { user, loading } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);


    if (loading || !user) {
        return <div className="text-center p-10">Проверка авторизации...</div>;
    }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Загрузить видео</CardTitle>
          <CardDescription>
            Эта функция находится в разработке. Скоро вы сможете загружать свои видеофрагменты.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="text-center py-16 border-2 border-dashed rounded-lg bg-muted/50">
                <h3 className="text-xl font-semibold text-foreground">Страница в разработке</h3>
                <p className="text-muted-foreground mt-2">
                    Мы усердно работаем над созданием формы загрузки!
                </p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
