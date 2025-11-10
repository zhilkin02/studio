'use client';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { collection, query, orderBy, doc, getDoc, writeBatch, deleteDoc, setDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Check, X, Loader2, Image as ImageIcon, Users, User, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteVideoFromYouTube } from '@/ai/flows/youtube-delete-flow';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';



function hexToHsl(hex: string): string | null {
    if (!hex) return null;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return null;

    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    
    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);
    
    return `${h} ${s}% ${l}%`;
}


// Helper to extract YouTube video ID from URL
const getYouTubeId = (url: string) => {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') {
            return urlObj.pathname.slice(1);
        }
        if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
            return urlObj.searchParams.get('v');
        }
        return null;
    } catch (e) {
        return null;
    }
};

interface Video {
    id: string;
    title: string;
    description?: string;
    keywords?: string[];
    filePath: string; // This will be a YouTube URL
    uploaderId: string;
}

function PendingVideosList() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [mutatingId, setMutatingId] = useState<string | null>(null);

    const pendingQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'pendingVideoFragments'), orderBy('uploadDate', 'desc'));
    }, [firestore]);

    const { data: videos, loading, error } = useCollection(pendingQuery, { listen: true });


    const handleApprove = async (video: Video) => {
        if (!firestore) return;
        setMutatingId(video.id);

        try {
            const batch = writeBatch(firestore);
            const pendingDocRef = doc(firestore, 'pendingVideoFragments', video.id);
            const publicDocRef = doc(firestore, 'publicVideoFragments', video.id);

            const pendingDocSnap = await getDoc(pendingDocRef);
            if (!pendingDocSnap.exists()) {
                throw new Error("Pending document not found.");
            }
            const videoData = pendingDocSnap.data();

            batch.set(publicDocRef, { ...videoData, status: 'approved' });
            batch.delete(pendingDocRef);

            await batch.commit();

            toast({
                title: "Видео одобрено!",
                description: `"${video.title}" теперь доступно для всех.`,
            });
        } catch (e: any) {
            console.error("Error approving video:", e);
             toast({
                variant: "destructive",
                title: "Ошибка одобрения",
                description: e.message,
            });
        } finally {
            setMutatingId(null);
        }
    };

    const handleReject = async (video: Video) => {
        if (!firestore) return;
        setMutatingId(video.id);

        const videoId = getYouTubeId(video.filePath);
        if (!videoId) {
            toast({ variant: "destructive", title: "Ошибка", description: "Не удалось извлечь ID видео из URL." });
            setMutatingId(null);
            return;
        }

        try {
            toast({ title: "Удаление с YouTube...", description: `Начался процесс удаления "${video.title}" с YouTube.` });
            const deleteResult = await deleteVideoFromYouTube({ videoId });

            if (!deleteResult.success) {
                throw new Error(deleteResult.error || "Не удалось удалить видео с YouTube.");
            }
            
            toast({ title: "Удалено с YouTube", description: "Видео успешно удалено. Удаление из базы данных..." });
            
            const docRef = doc(firestore, 'pendingVideoFragments', video.id);
            await deleteDoc(docRef);

            toast({ title: "Видео отклонено и удалено", description: `"${video.title}" было полностью удалено.` });

        } catch (e: any) {
             const permissionError = new FirestorePermissionError({
                    path: `pendingVideoFragments/${video.id}`,
                    operation: 'delete',
                });
             errorEmitter.emit('permission-error', permissionError);
            console.error("Error rejecting video:", e);
             toast({ variant: "destructive", title: "Ошибка отклонения", description: e.message || "Произошла неизвестная ошибка." });
        } finally {
            setMutatingId(null);
        }
    };


    if (loading) {
        return (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(2)].map((_, i) => (
                    <Card key={i}><CardHeader><Skeleton className="h-6 w-3/4 mb-2" /><Skeleton className="h-4 w-full" /></CardHeader><CardContent><Skeleton className="w-full h-auto aspect-video rounded-md" /></CardContent><CardFooter className="flex justify-end gap-2"><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-24" /></CardFooter></Card>
                ))}
            </div>
        );
    }

    if (error) {
        return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Ошибка загрузки видео</AlertTitle>
                <AlertDescription>
                    Не удалось получить данные для модерации. Проверьте права доступа к коллекции `pendingVideoFragments`.
                    <pre className="mt-2 text-xs bg-muted p-2 rounded">{error.message}</pre>
                </AlertDescription>
            </Alert>
        )
    }

    if (!videos || videos.length === 0) {
        return (
            <div className="text-center py-16 border-2 border-dashed rounded-lg bg-muted/50">
                <h3 className="text-xl font-semibold text-foreground">Все чисто!</h3>
                <p className="text-muted-foreground mt-2">Нет видео, ожидающих модерации.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(videos as Video[]).map((video) => {
                const videoId = getYouTubeId(video.filePath);
                const isMutating = mutatingId === video.id;
                return (
                    <Card key={video.id}>
                        <CardHeader>
                            <CardTitle className="truncate">{video.title}</CardTitle>
                            {video.description && <CardDescription className="line-clamp-3">{video.description}</CardDescription>}
                             {video.keywords && video.keywords.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-2">
                                    {video.keywords.map(kw => <Badge key={kw} variant="outline">{kw}</Badge>)}
                                </div>
                            )}
                        </CardHeader>
                        <CardContent>
                            {videoId ? (<iframe src={`https://www.youtube.com/embed/${videoId}`} title={video.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full rounded-md aspect-video" ></iframe>) : (<div className="w-full rounded-md aspect-video bg-muted flex items-center justify-center"><p className="text-muted-foreground">Неверный URL видео</p></div>)}
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => handleReject(video)} disabled={isMutating}>
                                {isMutating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                                Отклонить
                            </Button>
                             <Button onClick={() => handleApprove(video)} disabled={isMutating}>
                                {isMutating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                Одобрить
                             </Button>
                        </CardFooter>
                    </Card>
                )
            })}
        </div>
    );
}

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'Неверный HEX формат.');
const appearanceFormSchema = z.object({
  primaryHex: hexColor,
  secondaryHex: hexColor,
  backgroundHex: hexColor,
  foregroundHex: hexColor,
  accentHex: hexColor,
  mutedHex: hexColor,
  destructiveHex: hexColor,
  cardHex: hexColor,
  borderHex: hexColor,
  inputHex: hexColor,
  ringHex: hexColor,
  primaryForegroundHex: hexColor,
  secondaryForegroundHex: hexColor,
  accentForegroundHex: hexColor,
  mutedForegroundHex: hexColor,
  destructiveForegroundHex: hexColor,
  cardForegroundHex: hexColor,
  popoverHex: hexColor,
  popoverForegroundHex: hexColor,
  backgroundOpacity: z.number().min(0).max(1),
  cardOpacity: z.number().min(0).max(1),
  popoverOpacity: z.number().min(0).max(1),
});

const defaultDarkTheme = {
    primaryHex: '#8b5cf6',
    secondaryHex: '#374151',
    backgroundHex: '#111827',
    foregroundHex: '#f8fafc',
    accentHex: '#34d399',
    mutedHex: '#374151',
    destructiveHex: '#ef4444',
    cardHex: '#1f2937',
    borderHex: '#374151',
    inputHex: '#374151',
    ringHex: '#8b5cf6',
    primaryForegroundHex: '#f8fafc',
    secondaryForegroundHex: '#f9fafb',
    accentForegroundHex: '#111827',
    mutedForegroundHex: '#9ca3af',
    destructiveForegroundHex: '#f8fafc',
    cardForegroundHex: '#f9fafb',
    popoverHex: '#1f2937',
    popoverForegroundHex: '#f9fafb',
    backgroundOpacity: 1,
    cardOpacity: 1,
    popoverOpacity: 1,
}

const defaultLightTheme = {
    primaryHex: '#7c3aed',
    secondaryHex: '#e5e7eb',
    backgroundHex: '#f8fafc',
    foregroundHex: '#020617',
    accentHex: '#10b981',
    mutedHex: '#f3f4f6',
    destructiveHex: '#dc2626',
    cardHex: '#ffffff',
    borderHex: '#e5e7eb',
    inputHex: '#e5e7eb',
    ringHex: '#7c3aed',
    primaryForegroundHex: '#f8fafc',
    secondaryForegroundHex: '#1f2937',
    accentForegroundHex: '#f8fafc',
    mutedForegroundHex: '#6b7280',
    destructiveForegroundHex: '#f8fafc',
    cardForegroundHex: '#020617',
    popoverHex: '#ffffff',
    popoverForegroundHex: '#020617',
    backgroundOpacity: 1,
    cardOpacity: 1,
    popoverOpacity: 1,
}


function ThemeCustomizer({ themeType, themeData, isLoading, onSave }: { themeType: 'light' | 'dark', themeData: any, isLoading: boolean, onSave: (values: any) => Promise<void> }) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const defaultValues = themeType === 'dark' ? defaultDarkTheme : defaultLightTheme;

    const form = useForm<z.infer<typeof appearanceFormSchema>>({
        resolver: zodResolver(appearanceFormSchema),
        defaultValues: defaultValues
    });

    useEffect(() => {
        if (themeData) {
            form.reset({
                ...defaultValues,
                ...themeData
            });
        } else {
             form.reset(defaultValues);
        }
    }, [themeData, form, defaultValues]);

    const watchedValues = form.watch();

    const previewStyle: React.CSSProperties = {
        '--background': hexToHsl(watchedValues.backgroundHex ?? ''),
        '--foreground': hexToHsl(watchedValues.foregroundHex ?? ''),
        '--card': hexToHsl(watchedValues.cardHex ?? ''),
        '--card-foreground': hexToHsl(watchedValues.cardForegroundHex ?? ''),
        '--popover': hexToHsl(watchedValues.popoverHex ?? ''),
        '--popover-foreground': hexToHsl(watchedValues.popoverForegroundHex ?? ''),
        '--primary': hexToHsl(watchedValues.primaryHex ?? ''),
        '--primary-foreground': hexToHsl(watchedValues.primaryForegroundHex ?? ''),
        '--secondary': hexToHsl(watchedValues.secondaryHex ?? ''),
        '--secondary-foreground': hexToHsl(watchedValues.secondaryForegroundHex ?? ''),
        '--muted': hexToHsl(watchedValues.mutedHex ?? ''),
        '--muted-foreground': hexToHsl(watchedValues.mutedForegroundHex ?? ''),
        '--accent': hexToHsl(watchedValues.accentHex ?? ''),
        '--accent-foreground': hexToHsl(watchedValues.accentForegroundHex ?? ''),
        '--destructive': hexToHsl(watchedValues.destructiveHex ?? ''),
        '--destructive-foreground': hexToHsl(watchedValues.destructiveForegroundHex ?? ''),
        '--border': hexToHsl(watchedValues.borderHex ?? ''),
        '--input': hexToHsl(watchedValues.inputHex ?? ''),
        '--ring': hexToHsl(watchedValues.ringHex ?? ''),
        '--background-opacity': watchedValues.backgroundOpacity,
        '--card-opacity': watchedValues.cardOpacity,
        '--popover-opacity': watchedValues.popoverOpacity,
    } as React.CSSProperties;

    async function onSubmit(values: z.infer<typeof appearanceFormSchema>) {
        setIsSubmitting(true);
        try {
            await onSave(values);
            toast({
                title: "Настройки сохранены",
                description: `Внешний вид ${themeType === 'dark' ? 'тёмной' : 'светлой'} темы был успешно обновлен.`,
            });
        } catch (e: any) {
            toast({
                variant: "destructive",
                title: "Ошибка сохранения",
                description: e.message || "Не удалось сохранить настройки. Проверьте права доступа в консоли Firebase.",
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    if (isLoading) {
        return (
            <div className="space-y-8">
                <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <Separator />
                <div className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                </div>
                <Skeleton className="h-10 w-32" />
            </div>
        )
    }

    const ColorPickerInput = ({ name, label }: { name: keyof z.infer<typeof appearanceFormSchema>, label: string }) => (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                        <div className="relative">
                            <Input {...field} disabled={isSubmitting} className="pr-12" value={field.value as string || ''}/>
                            <Controller
                                name={name}
                                control={form.control}
                                render={({ field: { onChange, value } }) => (
                                    <input type="color" value={value as string || '#000000'} onChange={onChange} className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-10 p-1 rounded-md cursor-pointer border bg-card" />
                                )}
                            />
                        </div>
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );

    const OpacitySlider = ({ name, label }: { name: "backgroundOpacity" | "cardOpacity" | "popoverOpacity", label: string }) => (
         <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <div className="flex justify-between items-center">
                        <FormLabel>{label}</FormLabel>
                        <span className="text-sm text-muted-foreground">{Math.round((field.value as number) * 100)}%</span>
                    </div>
                    <FormControl>
                        <Slider
                            min={0}
                            max={1}
                            step={0.01}
                            value={[field.value as number]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            disabled={isSubmitting}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );


    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                     <div>
                         <h3 className="text-lg font-medium mb-4">Основные цвета</h3>
                         <div className="grid grid-cols-2 gap-4">
                            <ColorPickerInput name="primaryHex" label="Основной" />
                            <ColorPickerInput name="primaryForegroundHex" label="Текст на основном" />
                            <ColorPickerInput name="secondaryHex" label="Вторичный" />
                            <ColorPickerInput name="secondaryForegroundHex" label="Текст на вторичном" />
                            <ColorPickerInput name="accentHex" label="Акцент" />
                            <ColorPickerInput name="accentForegroundHex" label="Текст на акценте" />
                         </div>
                    </div>

                    <Separator />
                     <div>
                         <h3 className="text-lg font-medium mb-4">Фон и текст</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <ColorPickerInput name="backgroundHex" label="Фон сайта" />
                            <ColorPickerInput name="foregroundHex" label="Основной текст" />
                            <ColorPickerInput name="mutedHex" label="Приглушенный фон" />
                            <ColorPickerInput name="mutedForegroundHex" label="Приглушенный текст" />
                          </div>
                    </div>
                    
                     <Separator />
                     <div>
                         <h3 className="text-lg font-medium mb-4">Прозрачность</h3>
                          <div className="space-y-4">
                             <OpacitySlider name="backgroundOpacity" label="Прозрачность фона" />
                             <OpacitySlider name="cardOpacity" label="Прозрачность карточек" />
                             <OpacitySlider name="popoverOpacity" label="Прозрачность поповеров" />
                          </div>
                    </div>

                    <Separator />
                     <div>
                         <h3 className="text-lg font-medium mb-4">Компоненты</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <ColorPickerInput name="cardHex" label="Фон карточки" />
                            <ColorPickerInput name="cardForegroundHex" label="Текст на карточке" />
                            <ColorPickerInput name="popoverHex" label="Фон поповера" />
                            <ColorPickerInput name="popoverForegroundHex" label="Текст на поповере" />
                            <ColorPickerInput name="borderHex" label="Рамки" />
                            <ColorPickerInput name="inputHex" label="Поля ввода" />
                            <ColorPickerInput name="ringHex" label="Кольцо фокуса" />
                          </div>
                    </div>

                    <Separator />
                    <div>
                        <h3 className="text-lg font-medium mb-4">Ошибки / Удаление</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <ColorPickerInput name="destructiveHex" label="Цвет ошибок" />
                            <ColorPickerInput name="destructiveForegroundHex" label="Текст на ошибках" />
                        </div>
                    </div>

                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Сохранить изменения
                    </Button>
                </div>
                
                <div className="space-y-6">
                    <h3 className="text-lg font-medium">Панель предпросмотра</h3>
                     <div style={previewStyle} className="rounded-lg border p-6 bg-background text-foreground space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Пример карточки</CardTitle>
                                <CardDescription>Это описание карточки.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p>Это основной контент внутри карточки. Здесь используется цвет текста карточки.</p>
                            </CardContent>
                            <CardFooter className="flex justify-between">
                                <Button variant="ghost">Отмена</Button>
                                <Button>Принять</Button>
                            </CardFooter>
                        </Card>
                        <div className="flex flex-wrap gap-4 items-center">
                            <Button>Основная</Button>
                            <Button variant="secondary">Вторичная</Button>
                            <Button variant="destructive">Удалить</Button>
                            <Button variant="outline">Контурная</Button>
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline">Поповер</Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80">
                                    <div className="grid gap-4">
                                        <div className="space-y-2">
                                            <h4 className="font-medium leading-none">Пример поповера</h4>
                                            <p className="text-sm text-muted-foreground">Это содержимое всплывающего окна.</p>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <Alert variant="default">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Обычное уведомление</AlertTitle>
                            <AlertDescription>Это пример обычного уведомления для информации.</AlertDescription>
                        </Alert>
                         <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Уведомление об ошибке</AlertTitle>
                            <AlertDescription>Это пример уведомления об ошибке.</AlertDescription>
                         </Alert>
                        <p>Это <span className="text-primary">основной</span>, <span className="text-secondary">вторичный</span>, <span className="text-accent">акцентный</span> и <span className="text-muted-foreground">приглушенный</span> текст.</p>
                    </div>
                </div>
            </form>
        </Form>
    );
}

function AppearanceSettings() {
    const firestore = useFirestore();
    const [activeTab, setActiveTab] = useState<'dark-theme' | 'light-theme' | 'hero'>('dark-theme');

    const darkThemeDocRef = useMemo(() => firestore ? doc(firestore, 'site_settings', 'theme_dark') : null, [firestore]);
    const lightThemeDocRef = useMemo(() => firestore ? doc(firestore, 'site_settings', 'theme_light') : null, [firestore]);
    const contentDocRef = useMemo(() => firestore ? doc(firestore, 'site_content', 'main') : null, [firestore]);

    const { data: darkThemeSettings, loading: darkThemeLoading, error: darkThemeError } = useDoc(darkThemeDocRef, { listen: true });
    const { data: lightThemeSettings, loading: lightThemeLoading, error: lightThemeError } = useDoc(lightThemeDocRef, { listen: true });
    const { data: contentSettings, loading: contentLoading, error: contentError } = useDoc(contentDocRef, { listen: true });

    const heroImageForm = useForm<{ heroImageUrl: string; heroImageObjectFit: string, heroImageObjectPosition: string }>({
        resolver: zodResolver(z.object({
            heroImageUrl: z.string().url("Неверный URL.").or(z.literal('')),
            heroImageObjectFit: z.enum(['cover', 'contain', 'fill', 'none', 'scale-down']),
            heroImageObjectPosition: z.enum(['center', 'top', 'bottom', 'left', 'right', 'left top', 'right top', 'left bottom', 'right bottom']),
        })),
        defaultValues: {
            heroImageUrl: '',
            heroImageObjectFit: 'cover',
            heroImageObjectPosition: 'center',
        }
    });
    const [isHeroSubmitting, setIsHeroSubmitting] = useState(false);

    useEffect(() => {
        if (contentSettings) {
            heroImageForm.reset({
                heroImageUrl: contentSettings.heroImageUrl || '',
                heroImageObjectFit: contentSettings.heroImageObjectFit || 'cover',
                heroImageObjectPosition: contentSettings.heroImageObjectPosition || 'center',
            });
        }
    }, [contentSettings, heroImageForm]);


    const handleThemeSave = async (values: any) => {
        const themeDocRef = activeTab === 'dark-theme' ? darkThemeDocRef : lightThemeDocRef;
        if (!themeDocRef) return;
        
        const themeData = {
            ...values,
            background: hexToHsl(values.backgroundHex),
            foreground: hexToHsl(values.foregroundHex),
            card: hexToHsl(values.cardHex),
            cardForeground: hexToHsl(values.cardForegroundHex),
            popover: hexToHsl(values.popoverHex),
            popoverForeground: hexToHsl(values.popoverForegroundHex),
            primary: hexToHsl(values.primaryHex),
            primaryForeground: hexToHsl(values.primaryForegroundHex),
            secondary: hexToHsl(values.secondaryHex),
            secondaryForeground: hexToHsl(values.secondaryForegroundHex),
            muted: hexToHsl(values.mutedHex),
            mutedForeground: hexToHsl(values.mutedForegroundHex),
            accent: hexToHsl(values.accentHex),
            accentForeground: hexToHsl(values.accentForegroundHex),
            destructive: hexToHsl(values.destructiveHex),
            destructiveForeground: hexToHsl(values.destructiveForegroundHex),
            border: hexToHsl(values.borderHex),
            input: hexToHsl(values.inputHex),
            ring: hexToHsl(values.ringHex),
        };
        
        return setDoc(themeDocRef, themeData, { merge: true }).catch((err) => {
             const permissionError = new FirestorePermissionError({
                path: themeDocRef.path,
                operation: 'update',
                requestResourceData: themeData,
            });
            errorEmitter.emit('permission-error', permissionError);
            throw err;
        });
    };

    const onHeroImageSubmit = async (values: { heroImageUrl: string; heroImageObjectFit: string, heroImageObjectPosition: string }) => {
        if (!contentDocRef) return;
        setIsHeroSubmitting(true);
        try {
            await setDoc(contentDocRef, values, { merge: true });
            heroImageForm.reset(values); // To update form state after successful submission
             useToast().toast({
                title: "Изображение сохранено",
                description: "Настройки изображения на главной странице обновлены.",
            });
        } catch (e: any) {
            const permissionError = new FirestorePermissionError({
                path: contentDocRef.path,
                operation: 'update',
                requestResourceData: values,
            });
            errorEmitter.emit('permission-error', permissionError);
            useToast().toast({ variant: "destructive", title: "Ошибка", description: e.message });
        } finally {
            setIsHeroSubmitting(false);
        }
    };
    
    const loading = darkThemeLoading || lightThemeLoading || contentLoading;
    const error = darkThemeError || lightThemeError || contentError;

    if (error) {
        return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Ошибка загрузки настроек</AlertTitle>
                <AlertDescription>
                    Не удалось получить данные темы или контента. Проверьте права доступа.
                    <pre className="mt-2 text-xs bg-muted p-2 rounded">{error.message}</pre>
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Внешний вид</CardTitle>
                <CardDescription>
                   Настройте цветовую схему и другие элементы для всего сайта. 
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="hero">Изображение</TabsTrigger>
                        <TabsTrigger value="dark-theme">Тёмная тема</TabsTrigger>
                        <TabsTrigger value="light-theme">Светлая тема</TabsTrigger>
                    </TabsList>
                    <TabsContent value="hero" className="mt-6">
                        <Card>
                            <CardHeader>
                               <CardTitle>Изображение на главной</CardTitle>
                               <CardDescription>Настройте изображение, которое отображается вверху главной страницы.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form {...heroImageForm}>
                                <form onSubmit={heroImageForm.handleSubmit(onHeroImageSubmit)} className="space-y-6 max-w-lg">
                                    <FormField
                                        control={heroImageForm.control}
                                        name="heroImageUrl"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>URL изображения</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input {...field} disabled={isHeroSubmitting} className="pl-10" placeholder="https://example.com/image.png" />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={heroImageForm.control}
                                        name="heroImageObjectFit"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Масштабирование</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger><SelectValue placeholder="Выберите режим..." /></SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="cover">Покрытие (обрезается)</SelectItem>
                                                        <SelectItem value="contain">Вписать (с полями)</SelectItem>
                                                        <SelectItem value="fill">Заполнение (с искажением)</SelectItem>
                                                        <SelectItem value="none">Без масштабирования</SelectItem>
                                                        <SelectItem value="scale-down">Уменьшить до размера</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={heroImageForm.control}
                                        name="heroImageObjectPosition"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Позиционирование</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                     <FormControl>
                                                        <SelectTrigger><SelectValue placeholder="Выберите фокус..." /></SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="center">Центр</SelectItem>
                                                        <SelectItem value="top">Верх</SelectItem>
                                                        <SelectItem value="bottom">Низ</SelectItem>
                                                        <SelectItem value="left">Лево</SelectItem>
                                                        <SelectItem value="right">Право</SelectItem>
                                                        <SelectItem value="left top">Лево / Верх</SelectItem>
                                                        <SelectItem value="right top">Право / Верх</SelectItem>
                                                        <SelectItem value="left bottom">Лево / Низ</SelectItem>
                                                        <SelectItem value="right bottom">Право / Низ</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="submit" disabled={isHeroSubmitting}>
                                        {isHeroSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Сохранить изображение
                                    </Button>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="dark-theme" className="mt-6">
                        <ThemeCustomizer themeType="dark" themeData={darkThemeSettings} isLoading={darkThemeLoading} onSave={handleThemeSave} />
                    </TabsContent>
                    <TabsContent value="light-theme" className="mt-6">
                        <ThemeCustomizer themeType="light" themeData={lightThemeSettings} isLoading={lightThemeLoading} onSave={handleThemeSave} />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
}

interface UserListItem {
    id: string;
    email?: string;
    displayName?: string;
    photoURL?: string;
    isAdmin: boolean;
}

function UserManagement() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null);

    const usersQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'));
    }, [firestore]);

    const adminRolesQuery = useMemo(() => {
        if (!firestore) return null;
        return collection(firestore, 'roles_admin');
    }, [firestore]);

    const { data: users, loading: usersLoading, error: usersError } = useCollection(usersQuery, { listen: true });
    const { data: adminRoles, loading: adminsLoading, error: adminsError } = useCollection(adminRolesQuery, { listen: true });

    const adminIds = useMemo(() => new Set(adminRoles?.map(role => role.id)), [adminRoles]);

    const combinedUsers: UserListItem[] = useMemo(() => {
        if (!users) return [];
        return users.map(user => ({
            ...user,
            id: user.id,
            isAdmin: adminIds.has(user.id),
        }));
    }, [users, adminIds]);


    const handleAdminToggle = async (userId: string, currentIsAdmin: boolean) => {
        if (!firestore) return;
        setTogglingAdmin(userId);
        const user = combinedUsers.find(u => u.id === userId);

        const roleRef = doc(firestore, 'roles_admin', userId);
        const action = currentIsAdmin ? 'удаления' : 'назначения';
        const roleName = user?.displayName || user?.email || userId;

        try {
            if (currentIsAdmin) {
                await deleteDoc(roleRef);
            } else {
                await setDoc(roleRef, {});
            }
            toast({
                title: 'Роль обновлена',
                description: `Пользователь ${roleName} ${currentIsAdmin ? 'больше не администратор' : 'теперь администратор'}.`
            });
        } catch (e: any) {
            const permissionError = new FirestorePermissionError({
                path: roleRef.path,
                operation: currentIsAdmin ? 'delete' : 'create',
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({
                variant: 'destructive',
                title: `Ошибка ${action} роли`,
                description: e.message || 'Произошла неизвестная ошибка.',
            });
        } finally {
            setTogglingAdmin(null);
        }
    };

    const loading = usersLoading || adminsLoading;
    const error = usersError || adminsError;

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-4 w-2/3 mt-2" />
                </CardHeader>
                <CardContent>
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center space-x-4 p-2">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-[250px]" />
                                <Skeleton className="h-4 w-[200px]" />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }
    
    if (error) {
        return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Ошибка загрузки пользователей</AlertTitle>
                <AlertDescription>
                   Не удалось получить список пользователей или их роли.
                    <pre className="mt-2 text-xs bg-muted p-2 rounded">{error.message}</pre>
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Управление пользователями</CardTitle>
                <CardDescription>
                    Назначайте или отзывайте права администратора у пользователей.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Пользователь</TableHead>
                            <TableHead>Роль</TableHead>
                            <TableHead className="text-right">Администратор</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {combinedUsers.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarImage src={user.photoURL} />
                                            <AvatarFallback>{user.email?.[0]?.toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="font-medium">{user.displayName || 'Без имени'}</div>
                                            <div className="text-sm text-muted-foreground">{user.email}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {user.isAdmin ? (
                                        <Badge><Shield className="mr-1 h-3 w-3" />Админ</Badge>
                                    ) : (
                                        <Badge variant="outline"><User className="mr-1 h-3 w-3" />Пользователь</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Switch
                                        checked={user.isAdmin}
                                        onCheckedChange={() => handleAdminToggle(user.id, user.isAdmin)}
                                        disabled={togglingAdmin === user.id}
                                        aria-label={`Переключить права администратора для ${user.displayName}`}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

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
        return <div className="flex justify-center items-center min-h-[calc(100vh-12rem)]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/><p className="ml-4 text-muted-foreground">Проверка прав доступа...</p></div>;
    }


  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Панель администратора</h1>
        <p className="text-muted-foreground">Управление контентом и внешним видом проекта.</p>
      </div>

      <Tabs defaultValue="moderation" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="moderation">Модерация</TabsTrigger>
            <TabsTrigger value="appearance">Внешний вид</TabsTrigger>
            <TabsTrigger value="users">Пользователи</TabsTrigger>
        </TabsList>
        <TabsContent value="moderation" className="mt-6">
            <PendingVideosList />
        </TabsContent>
        <TabsContent value="appearance" className="mt-6">
            <AppearanceSettings />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
            <UserManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}

    
