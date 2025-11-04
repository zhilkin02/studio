'use client';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Loader2, UploadCloud, FileVideo, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { v4 as uuidv4 } from 'uuid';

const formSchema = z.object({
  title: z.string().min(5, 'Название должно быть не менее 5 символов.').max(100, 'Название должно быть не более 100 символов.'),
  description: z.string().min(10, 'Описание должно быть не менее 10 символов.').max(500, 'Описание должно быть не более 500 символов.'),
});


export default function UploadPage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
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
    const file = event.target.files?.[0];
    if (file) {
        if (file.size > 100 * 1024 * 1024) { // 100 MB limit
            toast({
                variant: 'destructive',
                title: 'Файл слишком большой',
                description: 'Пожалуйста, выберите видео размером до 100 МБ.',
            });
            return;
        }
        setVideoFile(file);
    }
  }
  
  const handleRemoveFile = () => {
    setVideoFile(null);
    const fileInput = document.getElementById('video-upload') as HTMLInputElement;
    if(fileInput) fileInput.value = '';
  }


  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user || !firestore) {
        toast({
            variant: "destructive",
            title: "Ошибка",
            description: "Вы не авторизованы или база данных недоступна.",
        });
        return;
    };
    if (!videoFile) {
        toast({
            variant: "destructive",
            title: "Видео не выбрано",
            description: "Пожалуйста, выберите видеофайл для загрузки.",
        });
        return;
    }
    
    setIsSubmitting(true);
    setUploadProgress(0);

    const storage = getStorage();
    const uniqueFileName = `${user.uid}-${uuidv4()}-${videoFile.name}`;
    const storageRef = ref(storage, `videos/${uniqueFileName}`);
    const uploadTask = uploadBytesResumable(storageRef, videoFile);

    uploadTask.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(Math.round(progress));
        },
        (error) => {
            console.error("Upload error:", error);
            setIsSubmitting(false);
            setUploadProgress(0);
            toast({
                variant: "destructive",
                title: "Ошибка загрузки",
                description: `Не удалось загрузить видео. Код ошибки: ${error.code}`,
            });
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
                        setVideoFile(null);
                        router.push('/profile');
                    })
                    .catch((serverError) => {
                        // Если запись в Firestore не удалась, удаляем уже загруженный файл
                        deleteObject(storageRef).catch(err => console.error("Error deleting orphaned file:", err));
                        
                        const permissionError = new FirestorePermissionError({
                          path: pendingCollectionRef.path,
                          operation: 'create',
                          requestResourceData: docData,
                        });
                        errorEmitter.emit('permission-error', permissionError);
                    }).finally(() => {
                        setIsSubmitting(false);
                        setUploadProgress(0);
                    });
            });
        }
    );
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
            Заполните форму ниже, чтобы загрузить видео. После проверки администратором оно появится на сайте.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormItem>
                  <FormLabel>Видеофайл</FormLabel>
                   <FormControl>
                        <div className="flex flex-col items-center justify-center w-full">
                            { !videoFile ? (
                                <label htmlFor="video-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80 transition-colors">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <UploadCloud className="w-10 h-10 mb-4 text-muted-foreground" />
                                        <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Нажмите для загрузки</span> или перетащите файл</p>
                                        <p className="text-xs text-muted-foreground">MP4, WebM, Ogg (до 100МБ)</p>
                                    </div>
                                    <Input id="video-upload" type="file" className="hidden" onChange={handleFileChange} accept="video/mp4,video/webm,video/ogg" />
                                </label>
                            ) : (
                               <div className="w-full p-4 border rounded-lg bg-muted/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <FileVideo className="h-8 w-8 text-primary" />
                                        <div className="truncate">
                                            <p className="text-sm font-medium truncate">{videoFile.name}</p>
                                            <p className="text-xs text-muted-foreground">{(videoFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" onClick={handleRemoveFile} className="shrink-0">
                                        <X className="h-4 w-4" />
                                        <span className="sr-only">Удалить файл</span>
                                    </Button>
                                </div>
                            )}
                        </div>
                   </FormControl>
                  <FormMessage />
                </FormItem>


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

                {isSubmitting && (
                    <div className="space-y-2">
                        <Progress value={uploadProgress} />
                        <p className="text-sm text-muted-foreground text-center">Загрузка... {uploadProgress}%</p>
                    </div>
                )}

              <Button type="submit" disabled={isSubmitting || !videoFile}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Отправка...</> : 'Отправить на модерацию'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
