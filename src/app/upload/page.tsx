'use client';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
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
import { CheckCircle, UploadCloud, FileVideo, X } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Label } from '@/components/ui/label';

const formSchema = z.object({
  title: z.string().min(5, 'Название должно быть не менее 5 символов.').max(100, 'Название должно быть не более 100 символов.'),
  description: z.string().min(10, 'Описание должно быть не менее 10 символов.').max(500, 'Описание должно быть не более 500 символов.'),
});

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export default function UploadPage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
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
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setFileError(null);

    if (file) {
      if (!file.type.startsWith('video/')) {
        setFileError('Файл должен быть видео.');
        setVideoFile(null);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`Максимальный размер видео - ${MAX_FILE_SIZE / 1024 / 1024} МБ.`);
        setVideoFile(null);
        return;
      }
      setVideoFile(file);
    } else {
        setVideoFile(null);
    }
  };


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setFileError(null);
    if (!videoFile) {
        setFileError('Необходимо выбрать видеофайл для загрузки.');
        return;
    }
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

    const storage = getStorage();
    const uniqueFileName = `${user.uid}/${uuidv4()}-${videoFile.name}`;
    const storageRef = ref(storage, `videos/${uniqueFileName}`);

    const uploadTask = uploadBytesResumable(storageRef, videoFile);

    uploadTask.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(Math.round(progress));
        },
        (error) => {
            console.error("Error uploading video:", error);
            toast({
                variant: "destructive",
                title: "Ошибка загрузки",
                description: `Не удалось загрузить видео: ${error.message}`,
            });
            setIsUploading(false);
        },
        () => {
            getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
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
                    .then(() => {
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
                        setVideoFile(null);
                        setIsUploading(false);
                        router.push('/profile');
                    })
                    .catch((serverError) => {
                        const permissionError = new FirestorePermissionError({
                          path: pendingCollectionRef.path,
                          operation: 'create',
                          requestResourceData: docData,
                        });
                        errorEmitter.emit('permission-error', permissionError);
                        setIsUploading(false);
                });

            }).catch((error) => {
                 console.error("Error getting download URL:", error);
                 toast({
                    variant: "destructive",
                    title: "Ошибка",
                    description: `Не удалось получить URL видео: ${error.message}`,
                 });
                 setIsUploading(false);
            });
        }
    );
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
              
              <FormItem>
                <FormLabel>Видеофайл</FormLabel>
                <FormControl>
                  {!videoFile ? (
                    <div className="relative flex items-center justify-center w-full">
                      <label htmlFor="video-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted/75 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                              <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Нажмите для загрузки</span> или перетащите файл</p>
                              <p className="text-xs text-muted-foreground">MP4, WebM, Ogg (Макс. 100МБ)</p>
                          </div>
                          <Input id="video-upload" type="file" className="sr-only" accept="video/*"
                            onChange={handleFileChange}
                          />
                      </label>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                            <FileVideo className="h-6 w-6 text-muted-foreground" />
                            <div className='text-sm'>
                                <p className="font-medium truncate max-w-xs">{videoFile.name}</p>
                                <p className="text-muted-foreground">{(videoFile.size / (1024 * 1024)).toFixed(2)} МБ</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setVideoFile(null)} disabled={isUploading}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                  )}
                </FormControl>
                {fileError && <p className="text-sm font-medium text-destructive">{fileError}</p>}
              </FormItem>

              {isUploading && (
                  <div className="space-y-2">
                    <Label>Прогресс загрузки</Label>
                    <Progress value={uploadProgress} className="w-full" />
                    <p className="text-sm text-center text-muted-foreground">{uploadProgress}%</p>
                  </div>
              )}

              <Button type="submit" disabled={isUploading || !videoFile}>
                {isUploading ? `Загрузка... ${uploadProgress}%` : 'Отправить на модерацию'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
