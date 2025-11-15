'use client';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
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
import { useDebounce } from 'use-debounce';


const formSchema = z.object({
  phrase: z.string().min(1, 'Это поле обязательно для заполнения.'),
  sourceName: z.string().min(1, 'Название фильма или сериала обязательно.'),
  sourceDetails: z.string().optional(),
  voiceOver: z.string().optional(),
  timestampInSource: z.string().optional(),
  keywords: z.string().optional(),
});

function KeywordGenerator({ control, setValue }: { control: any, setValue: any }) {
    const [isGenerating, setIsGenerating] = useState(false);
    const phrase = useWatch({ control, name: 'phrase' });
    const sourceName = useWatch({ control, name: 'sourceName' });

    const [debouncedPhrase] = useDebounce(phrase, 1500);
    const [debouncedSourceName] = useDebounce(sourceName, 1500);
    
    const handleGenerateKeywords = useCallback(async () => {
        if (!debouncedPhrase || debouncedPhrase.length < 2) return;

        setIsGenerating(true);
        try {
            const result = await generateKeywords({ phrase: debouncedPhrase, sourceName: debouncedSourceName });
            if (result.keywords) {
                setValue('keywords', result.keywords, { shouldValidate: true });
            }
        } catch (error) {
            console.error("Failed to generate keywords:", error);
            // Optionally show a toast message
        } finally {
            setIsGenerating(false);
        }
    }, [debouncedPhrase, debouncedSourceName, setValue]);

    useEffect(() => {
        handleGenerateKeywords();
    }, [handleGenerateKeywords]);

    return (
        <div className="absolute right-2 top-2">
            {isGenerating ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
                <Sparkles className="h-5 w-5 text-yellow-500" />
            )}
        </div>
    );
}


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

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phrase: '',
      sourceName: '',
      sourceDetails: '',
      voiceOver: '',
      timestampInSource: '',
      keywords: '',
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
                title: `${values.sourceName} | ${values.phrase}`, // A more descriptive YouTube title
                description: `Фрагмент из "${values.sourceName}".\nФраза: ${values.phrase}`,
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
                phrase: values.phrase,
                sourceName: values.sourceName,
                sourceDetails: values.sourceDetails || '',
                voiceOver: values.voiceOver || '',
                timestampInSource: values.timestampInSource || '',
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
                name="phrase"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Фраза или описание действия</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Введите точную фразу из видео. Если слов нет, опишите действие или эмоцию."
                        className="resize-y"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sourceName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название фильма или сериала</FormLabel>
                    <FormControl>
                      <Input placeholder="Например, 'Криминальное чтиво'" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <FormField
                    control={form.control}
                    name="sourceDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Сезон и серия / Часть фильма (необязательно)</FormLabel>
                        <FormControl>
                          <Input placeholder="S01E05 / Часть 2" {...field} disabled={isSubmitting} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="timestampInSource"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Время в фильме / серии (необязательно)</FormLabel>
                        <FormControl>
                          <Input placeholder="01:23:45" {...field} disabled={isSubmitting} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
              </div>

               <FormField
                control={form.control}
                name="voiceOver"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Озвучка (необязательно)</FormLabel>
                    <FormControl>
                      <Input placeholder="Дубляж, LostFilm, Кубик в Кубе" {...field} disabled={isSubmitting} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="keywords"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ключевые слова</FormLabel>
                    <div className="relative">
                        <FormControl>
                        <Textarea
                            placeholder="AI сгенерирует ключевые слова здесь..."
                            className="resize-y min-h-[80px]"
                            {...field}
                            disabled={isSubmitting}
                        />
                        </FormControl>
                        <KeywordGenerator control={form.control} setValue={form.setValue} />
                    </div>
                     <FormDescription>
                      Перечислите через запятую ключевые слова, которые помогут найти это видео. AI поможет вам с этим.
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
