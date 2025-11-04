'use client';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';

export default function AdminPage() {
    const { user, loading } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/login');
            } else if (!user.isAdmin) {
                router.push('/');
            }
        }
    }, [user, loading, router]);

    if (loading || !user || !user.isAdmin) {
        return <div className="text-center p-10">Проверка прав доступа...</div>;
    }


  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Панель администратора</CardTitle>
          <CardDescription>
            Управление видеофрагментами и пользователями.
          </CardDescription>
        </CardHeader>
        <CardContent>
             <Alert>
                <Terminal className="h-4 w-4" />
                <AlertTitle>В разработке!</AlertTitle>
                <AlertDescription>
                    Эта страница находится в активной разработке. Скоро здесь появится функционал для модерации видео.
                </AlertDescription>
            </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
