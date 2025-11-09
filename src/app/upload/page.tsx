'use client';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
import { CheckCircle, Loader2, UploadCloud } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { uploadVideoToYouTube } from '@/ai/flows/youtube-upload-flow';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


const formSchema = z.object({
  title: z.string().min(5, 'Название должно быть не менее 5 символов.').max(100, 'Название должно быть не более 100 символов.'),
  description: z.string().min(10, 'Описание должно быть не менее 10 символов.').max(5000, 'Описание должно быть не более 5000 символов.'),
});

export default function UploadPage() {
  const { user } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0); 
  const [uploadMessage, setUploadMessage] = useState('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        toast({
          variant: "destructive",
          title: "Неверный тип файла",
          description: "Пожалуйста, выберите видеофайл.",
        });
        return;
      }
      setVideoFile(file);
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore) {
      toast({ variant: "destructive", title: "Ошибка", description: "База данных недоступна." });
      return;
    }
    if (!videoFile) {
        toast({ variant: "destructive", title: "Видеофайл не выбран", description: "Пожалуйста, выберите видеофайл для загрузки." });
        return;
    }

    setIsSubmitting(true);
    
    try {
        const reader = new FileReader();
        reader.readAsDataURL(videoFile);
        reader.onload = async () => {
            const videoDataUri = reader.result as string;
            
            setUploadMessage("Отправка видео на сервер...");
            setUploadProgress(25);

            const result = await uploadVideoToYouTube({
                title: values.title,
                description: values.description,
                videoDataUri: videoDataUri
            });
            
            setUploadMessage("Видео загружено на YouTube. Сохранение в базе данных...");
            setUploadProgress(75);

            if (!result || !result.videoId) {
                throw new Error(result.error || 'Не удалось получить ID видео от YouTube.');
            }

            const pendingCollectionRef = collection(firestore, 'pendingVideoFragments');
            const youtubeUrl = `https://www.youtube.com/watch?v=${result.videoId}`;

            const docData = {
                title: values.title,
                description: values.description,
                filePath: youtubeUrl,
                uploaderId: user?.uid ?? 'anonymous',
                status: 'pending',
                uploadDate: serverTimestamp(),
            };

            addDoc(pendingCollectionRef, docData)
              .then(() => {
                setUploadProgress(100);
                setUploadMessage("Готово!");

                toast({
                    title: "Успешно отправлено!",
                    description: "Ваше видео загружено на YouTube и отправлено на модерацию.",
                    action: <div className="flex items-center"><CheckCircle className="text-green-500 mr-2"/><span>Отлично</span></div>
                });
                
                form.reset();
                setVideoFile(null);
                router.push('/');
                setIsSubmitting(false);
              })
              .catch(serverError => {
                const permissionError = new FirestorePermissionError({
                    path: pendingCollectionRef.path,
                    operation: 'create',
                    requestResourceData: docData,
                });
                errorEmitter.emit('permission-error', permissionError);

                toast({
                    variant: "destructive",
                    title: "Ошибка прав доступа",
                    description: 'Не удалось сохранить данные. Проверьте консоль для деталей.',
                });
                setUploadProgress(0);
                setUploadMessage('');
                setIsSubmitting(false);
              });
        };
        reader.onerror = (error) => {
            throw new Error('Не удалось прочитать файл: ' + error);
        }

    } catch (e: any) {
        console.error("Error in upload process:", e);
        toast({
            variant: "destructive",
            title: "Ошибка загрузки",
            description: e.message || 'Произошла неизвестная ошибка.',
        });
        setUploadProgress(0);
        setUploadMessage('');
        setIsSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Добавить новое видео</CardTitle>
          <CardDescription>
            Выберите видеофайл и заполните форму. Видео будет загружено на YouTube-канал проекта как "невидимое" и отправлено на модерацию.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
               <FormItem>
                  <FormLabel>Видеофайл</FormLabel>
                  <FormControl>
                    <div className="relative border-2 border-dashed border-muted-foreground/50 rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
                      <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground"/>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {videoFile ? `${videoFile.name} (${(videoFile.size / 1024 / 1024).toFixed(2)} MB)` : "Нажмите, чтобы выбрать файл"}
                      </p>
                      <Input 
                        id="video-upload"
                        type="file" 
                        accept="video/*" 
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={isSubmitting}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Выберите видео для загрузки (например, MP4, MOV, WebM).
                  </FormDescription>
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
                    <Progress value={uploadProgress} className="w-full" />
                    <p className="text-sm text-muted-foreground">{uploadMessage}</p>
                </div>
              )}


              <Button type="submit" disabled={isSubmitting || !videoFile}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Загрузка...</> : 'Загрузить и отправить на модерацию'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
