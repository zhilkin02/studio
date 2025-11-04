'use client';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Loader2, Link } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const formSchema = z.object({
  title: z.string().min(5, 'Название должно быть не менее 5 символов.').max(100, 'Название должно быть не более 100 символов.'),
  description: z.string().min(10, 'Описание должно быть не менее 10 символов.').max(500, 'Описание должно быть не более 500 символов.'),
  videoUrl: z.string().url('Пожалуйста, введите корректный URL-адрес видео.'),
});


export default function UploadPage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      videoUrl: '',
    },
  });

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);


  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user || !firestore) {
        toast({
            variant: "destructive",
            title: "Ошибка",
            description: "Вы не авторизованы или база данных недоступна.",
        });
        return;
    };
    
    setIsSubmitting(true);

    const pendingCollectionRef = collection(firestore, 'pendingVideoFragments');
                
    const docData = {
        title: values.title,
        description: values.description,
        filePath: values.videoUrl, // Используем URL из формы
        uploaderId: user.uid,
        status: 'pending',
        uploadDate: serverTimestamp(),
    };

    addDoc(pendingCollectionRef, docData)
        .then(() => {
            toast({
                title: "Успешно отправлено!",
                description: "Ваше видео отправлено на модерацию.",
                action: (
                    <div className="flex items-center">
                        <CheckCircle className="text-green-500 mr-2"/>
                        <span>Отлично</span>
                    </div>
                )
            });
            form.reset();
            router.push('/profile');
        })
        .catch((serverError) => {
            const permissionError = new FirestorePermissionError({
              path: pendingCollectionRef.path,
              operation: 'create',
              requestResourceData: docData,
            });
            errorEmitter.emit('permission-error', permissionError);
        }).finally(() => {
            setIsSubmitting(false);
        });
  }

  if (userLoading || !user) {
    return <div className="flex justify-center items-center min-h-[calc(100vh-12rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
        <p className="ml-4 text-muted-foreground">Проверка авторизации...</p>
    </div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Добавить новое видео</CardTitle>
          <CardDescription>
            Заполните форму ниже, чтобы добавить видео по ссылке. После проверки администратором оно появится на сайте.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
               <FormField
                control={form.control}
                name="videoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL видео</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="https://example.com/video.mp4" {...field} disabled={isSubmitting} className="pl-9" />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Вставьте прямую ссылку на видеофайл (например, MP4, WebM).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название</FormLabel>
                    <FormControl>
                      <Input placeholder="Например, 'Та самая сцена из...' " {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormDescription>
                      Краткое и емкое название для вашего фрагмента.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Описание</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Опишите, что происходит в видео, какие эмоции оно вызывает или чем оно примечательно."
                        className="resize-none"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                     <FormDescription>
                      Подробное описание поможет другим пользователям найти ваше видео.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Отправка...</> : 'Отправить на модерацию'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
