'use client';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, AlertCircle, UploadCloud } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Label } from '@/components/ui/label';


const formSchema = z.object({
  title: z.string().min(5, 'Название должно быть не менее 5 символов.').max(100, 'Название должно быть не более 100 символов.'),
  description: z.string().min(10, 'Описание должно быть не менее 10 символов.').max(500, 'Описание должно быть не более 500 символов.'),
  video: z.instanceof(FileList).refine(files => files?.length === 1, 'Необходимо загрузить один видеофайл.')
    .refine(files => files?.[0]?.type.startsWith('video/'), 'Файл должен быть видео.')
    .refine(files => files?.[0]?.size <= 100 * 1024 * 1024, 'Максимальный размер видео - 100 МБ.'),
});

export default function UploadPage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
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
    
    setIsUploading(true);
    setUploadProgress(0);

    const videoFile = values.video[0];
    const storage = getStorage();
    const uniqueFileName = `${user.uid}/${uuidv4()}-${videoFile.name}`;
    const storageRef = ref(storage, `videos/${uniqueFileName}`);

    try {
        // Imitate progress for now
        setUploadProgress(25);
        const snapshot = await uploadBytes(storageRef, videoFile);
        setUploadProgress(75);
        const downloadURL = await getDownloadURL(snapshot.ref);
        setUploadProgress(90);

        const pendingCollectionRef = collection(firestore, 'pendingVideoFragments');
        
        const docData = {
            title: values.title,
            description: values.description,
            filePath: downloadURL,
            uploaderId: user.uid,
            status: 'pending',
            uploadDate: serverTimestamp(),
        };

        addDoc(pendingCollectionRef, docData)
         .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
              path: pendingCollectionRef.path,
              operation: 'create',
              requestResourceData: docData,
            });
            errorEmitter.emit('permission-error', permissionError);
        });

        setUploadProgress(100);

        toast({
            title: "Успешно загружено!",
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

    } catch (error: any) {
        console.error("Error uploading video:", error);
        toast({
            variant: "destructive",
            title: "Ошибка загрузки",
            description: `Не удалось загрузить видео: ${error.message}`,
            action: (
                 <div className="flex items-center">
                    <AlertCircle className="text-white mr-2"/>
                    <span>Попробуйте еще раз</span>
                </div>
            )
        });
    } finally {
        setIsUploading(false);
        setUploadProgress(0);
    }
  }

  if (userLoading || !user) {
    return <div className="text-center p-10">Проверка авторизации...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Загрузить новый видеофрагмент</CardTitle>
          <CardDescription>
            Заполните форму ниже, чтобы добавить ваше видео. После проверки администратором оно появится на сайте.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название</FormLabel>
                    <FormControl>
                      <Input placeholder="Например, 'Та самая сцена из...' " {...field} />
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
                      />
                    </FormControl>
                     <FormDescription>
                      Подробное описание поможет другим пользователям найти ваше видео.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="video"
                render={({ field: { onChange, value, ...rest } }) => (
                  <FormItem>
                    <FormLabel>Видеофайл</FormLabel>
                    <FormControl>
                        <div className="relative flex items-center justify-center w-full">
                            <label htmlFor="video-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted/75 transition-colors">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Нажмите для загрузки</span> или перетащите файл</p>
                                    <p className="text-xs text-muted-foreground">MP4, WebM, Ogg (Макс. 100МБ)</p>
                                </div>
                                <Input id="video-upload" type="file" className="sr-only" accept="video/*"
                                  onChange={(e) => onChange(e.target.files)} {...rest}
                                />
                            </label>
                             {value?.[0] && <p className="text-sm text-center text-muted-foreground absolute bottom-4">{value[0].name}</p>}
                        </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
                />

              {isUploading && (
                  <div className="space-y-2">
                    <Label>Прогресс загрузки</Label>
                    <Progress value={uploadProgress} className="w-full" />
                    <p className="text-sm text-center text-muted-foreground">{uploadProgress}%</p>
                  </div>
              )}

              <Button type="submit" disabled={isUploading}>
                {isUploading ? 'Загрузка...' : 'Отправить на модерацию'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
