'use client';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
import { CheckCircle, Loader2, UploadCloud, Timer, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { uploadVideoToYouTube } from '@/ai/flows/youtube-upload-flow';
import { generateKeywords } from '@/ai/flows/generate-keywords-flow';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


const formSchema = z.object({
  title: z.string().min(5, 'Название должно быть не менее 5 символов.').max(100, 'Название должно быть не более 100 символов.'),
  description: z.string().max(5000, 'Описание должно быть не более 5000 символов.').optional(),
  keywords: z.string().optional(),
});

export default function UploadPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0); 
  const [uploadMessage, setUploadMessage] = useState('');
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      keywords: '',
    },
  });

  const watchedTitle = useWatch({ control: form.control, name: 'title' });
  const watchedDescription = useWatch({ control: form.control, name: 'description' });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);
  
  useEffect(() => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Only generate if title has some content
      if (watchedTitle && watchedTitle.trim().length > 4) {
          debounceTimeoutRef.current = setTimeout(async () => {
              setIsGeneratingKeywords(true);
              try {
                  const result = await generateKeywords({
                      title: watchedTitle,
                      description: watchedDescription || '',
                  });
                  if (result.keywords) {
                      form.setValue('keywords', result.keywords, { shouldValidate: true });
                  }
              } catch (e) {
                  // Don't bother the user with a toast for this, just log it.
                  console.error('Error generating keywords:', e);
              } finally {
                  setIsGeneratingKeywords(false);
              }
          }, 1000); // 1-second debounce delay
      }

      return () => {
          if (debounceTimeoutRef.current) {
              clearTimeout(debounceTimeoutRef.current);
          }
      };

  }, [watchedTitle, watchedDescription, form]);


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
      setQuotaExceeded(false); // Reset quota error when a new file is selected
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user) {
      toast({ variant: "destructive", title: "Ошибка", description: "База данных или пользователь недоступны." });
      return;
    }
    if (!videoFile) {
        toast({ variant: "destructive", title: "Видеофайл не выбран", description: "Пожалуйста, выберите видеофайл для загрузки." });
        return;
    }

    setIsSubmitting(true);
    setQuotaExceeded(false);
    
    const reader = new FileReader();
    reader.readAsDataURL(videoFile);

    reader.onload = async () => {
        try {
            const videoDataUri = reader.result as string;
            
            setUploadMessage("Отправка видео на сервер...");
            setUploadProgress(25);

            const result = await uploadVideoToYouTube({
                title: values.title,
                description: values.description || '', // Pass empty string if undefined
                videoDataUri: videoDataUri,
            });
            
            if (result.quotaExceeded) {
                setQuotaExceeded(true);
                setUploadProgress(0);
                setUploadMessage('');
                setIsSubmitting(false);
                toast({
                    variant: "destructive",
                    title: "Достигнут лимит загрузок YouTube",
                    description: "Суточный лимит на загрузку видео исчерпан. Пожалуйста, попробуйте снова позже."
                });
                return;
            }

            if (!result || !result.videoId) {
                 throw new Error(result.error || 'Не удалось получить ID видео от YouTube.');
            }

            setUploadMessage("Видео загружено на YouTube. Сохранение в базе данных...");
            setUploadProgress(75);

            const isAdmin = user.isAdmin;
            const collectionName = isAdmin ? 'publicVideoFragments' : 'pendingVideoFragments';
            const status = isAdmin ? 'approved' : 'pending';
            
            const targetCollectionRef = collection(firestore, collectionName);
            const youtubeUrl = `https://www.youtube.com/watch?v=${result.videoId}`;
            const keywords = values.keywords ? values.keywords.split(',').map(kw => kw.trim()).filter(Boolean) : [];

            const docData = {
                title: values.title,
                description: values.description || '',
                keywords: keywords,
                filePath: youtubeUrl,
                uploaderId: user.uid,
                status: status,
                uploadDate: serverTimestamp(),
            };

            await addDoc(targetCollectionRef, docData).catch((serverError) => {
                 const permissionError = new FirestorePermissionError({
                    path: targetCollectionRef.path,
                    operation: 'create',
                    requestResourceData: docData,
                });
                errorEmitter.emit('permission-error', permissionError);
                toast({ variant: 'destructive', title: 'Ошибка сохранения в БД', description: serverError.message });
                // Re-throw to be caught by the outer try-catch
                throw serverError;
            });

            setUploadProgress(100);
            setUploadMessage("Готово!");

            toast({
                title: isAdmin ? "Видео опубликовано!" : "Успешно отправлено!",
                description: isAdmin 
                    ? "Ваше видео было сразу опубликовано." 
                    : "Ваше видео загружено на YouTube и отправлено на модерацию.",
                action: <div className="flex items-center"><CheckCircle className="text-green-500 mr-2"/><span>Отлично</span></div>
            });
            
            form.reset();
            setVideoFile(null);
            router.push('/');

        } catch (e: any) {
            console.error("Error in upload process:", e);
             let errorMessage = e.message || 'Произошла неизвестная ошибка.';
            if (errorMessage.includes('invalid_client')) {
                errorMessage = "Ошибка аутентификации YouTube: неверный клиент. Проверьте учетные данные.";
            }

            toast({
                variant: "destructive",
                title: "Ошибка загрузки",
                description: errorMessage,
            });
            setUploadProgress(0);
            setUploadMessage('');
        } finally {
            setIsSubmitting(false);
        }
    };

    reader.onerror = (error) => {
        toast({
            variant: "destructive",
            title: "Ошибка чтения файла",
            description: 'Не удалось прочитать файл. ' + error,
        });
        setIsSubmitting(false);
    }
  }
  
  if (loading || !user) {
    return (
        <div className="flex justify-center items-center min-h-[calc(100vh-12rem)]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
            <p className="ml-4 text-muted-foreground">Загрузка...</p>
        </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Добавить новое видео</CardTitle>
          <CardDescription>
            {user.isAdmin 
              ? "Видео будет загружено на YouTube-канал проекта и сразу опубликовано."
              : "Выберите видеофайл и заполните форму. Видео будет загружено на YouTube-канал проекта как 'невидимое' и отправлено на модерацию."
            }
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

                {quotaExceeded && (
                    <Alert variant="destructive">
                        <Timer className="h-4 w-4" />
                        <AlertTitle>Достигнут лимит загрузок YouTube</AlertTitle>
                        <AlertDescription>
                           Суточный лимит на загрузку видео исчерпан. Пожалуйста, попробуйте снова позже.
                        </AlertDescription>
                    </Alert>
                )}

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
                    <FormLabel>Описание (необязательно)</FormLabel>
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
              <FormField
                control={form.control}
                name="keywords"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Ключевые слова</FormLabel>
                      {isGeneratingKeywords && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                          <Sparkles className="h-3 w-3" />
                          <span>AI генерирует...</span>
                        </div>
                      )}
                    </div>
                    <FormControl>
                      <Input
                        placeholder="смех, мем, цитата, ирония"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                     <FormDescription>
                      AI автоматически предложит ключевые слова. Их можно редактировать.
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


              <Button type="submit" disabled={isSubmitting || !videoFile || quotaExceeded}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Загрузка...</> : (user.isAdmin ? 'Загрузить и опубликовать' : 'Загрузить и отправить на модерацию')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
