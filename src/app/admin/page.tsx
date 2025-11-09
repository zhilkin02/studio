'use client';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { collection, query, orderBy, doc, getDoc, writeBatch, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Check, X, Loader2, Trash2, Pencil, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteVideoFromYouTube } from '@/ai/flows/youtube-delete-flow';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';


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

const editFormSchema = z.object({
  title: z.string().min(5, 'Название должно быть не менее 5 символов.').max(100, 'Название должно быть не более 100 символов.'),
  description: z.string().max(5000, 'Описание должно быть не более 5000 символов.').optional(),
  keywords: z.string().optional(),
});


interface Video {
    id: string;
    title: string;
    description?: string;
    keywords?: string[];
    filePath: string; // This will be a YouTube URL
    uploaderId: string;
}

function EditVideoForm({ video, onFinish }: { video: Video, onFinish: () => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof editFormSchema>>({
        resolver: zodResolver(editFormSchema),
        defaultValues: {
            title: video.title,
            description: video.description || '',
            keywords: video.keywords?.join(', ') || '',
        },
    });

    async function onSubmit(values: z.infer<typeof editFormSchema>) {
        if (!firestore) return;
        setIsSubmitting(true);

        const docRef = doc(firestore, 'publicVideoFragments', video.id);
        const data = {
            title: values.title,
            description: values.description,
            keywords: values.keywords ? values.keywords.split(',').map(kw => kw.trim()).filter(Boolean) : [],
        };

        updateDoc(docRef, data)
            .then(() => {
                toast({
                    title: "Видео обновлено!",
                    description: "Изменения были успешно сохранены.",
                });
                onFinish();
            })
            .catch((serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'update',
                    requestResourceData: data,
                });
                errorEmitter.emit('permission-error', permissionError);
                toast({
                    variant: "destructive",
                    title: "Ошибка обновления",
                    description: serverError.message || "Не удалось сохранить изменения.",
                });
            })
            .finally(() => {
                setIsSubmitting(false);
            });
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Название</FormLabel>
                            <FormControl>
                                <Input {...field} disabled={isSubmitting} />
                            </FormControl>
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
                                <Textarea className="resize-y" {...field} disabled={isSubmitting} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="keywords"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Ключевые слова</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder="фраза 1, фраза 2, еще фраза" disabled={isSubmitting} />
                            </FormControl>
                            <FormDescription>Перечислите ключевые слова через запятую.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary">Отмена</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Сохранить изменения
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    );
}

function PublicVideosList() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [mutatingId, setMutatingId] = useState<string | null>(null);
    const [editingVideo, setEditingVideo] = useState<Video | null>(null);
    const [searchQuery, setSearchQuery] = useState('');


    const publicQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'publicVideoFragments'), orderBy('uploadDate', 'desc'));
    }, [firestore]);

    const { data: videos, loading, error } = useCollection(publicQuery, { listen: true });

    const filteredVideos = useMemo(() => {
        if (!videos) return [];
        if (!searchQuery) return videos;

        const lowercasedQuery = searchQuery.toLowerCase();

        return (videos as Video[]).filter(video => {
            const titleMatch = video.title.toLowerCase().includes(lowercasedQuery);
            const descriptionMatch = video.description && video.description.toLowerCase().includes(lowercasedQuery);
            const keywordsMatch = video.keywords && video.keywords.some(kw => kw.toLowerCase().includes(lowercasedQuery));
            return titleMatch || descriptionMatch || keywordsMatch;
        });
    }, [videos, searchQuery]);


    const handleDelete = async (video: Video) => {
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
            const docRef = doc(firestore, 'publicVideoFragments', video.id);
            
            deleteDoc(docRef).catch((serverError) => {
                 const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'delete',
                });
                errorEmitter.emit('permission-error', permissionError);
                 toast({ variant: "destructive", title: "Ошибка удаления из БД", description: serverError.message });
            });

            toast({ title: "Видео удалено", description: `"${video.title}" было полностью удалено.` });

        } catch (e: any) {
            console.error("Error deleting video:", e);
            toast({ variant: "destructive", title: "Ошибка удаления", description: e.message || "Произошла неизвестная ошибка." });
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
                    Не удалось получить данные. Проверьте права доступа к коллекции `publicVideoFragments`.
                    <pre className="mt-2 text-xs bg-muted p-2 rounded">{error.message}</pre>
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <>
            <div className="mb-6 flex gap-2">
                <Input
                    type="search"
                    placeholder="Поиск по названию, описанию или ключевым словам..."
                    className="flex-grow"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                 <Button type="button" variant="secondary">
                    <Search className="mr-2 h-4 w-4" /> Поиск
                </Button>
            </div>
            
            {filteredVideos.length === 0 && (
                 <div className="text-center py-16 border-2 border-dashed rounded-lg bg-muted/50">
                    <h3 className="text-xl font-semibold text-foreground">{searchQuery ? 'Ничего не найдено' : 'Нет опубликованных видео'}</h3>
                    <p className="text-muted-foreground mt-2">{searchQuery ? 'Попробуйте изменить поисковый запрос.' : 'После одобрения они появятся здесь.'}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(filteredVideos as Video[]).map((video) => {
                    const videoId = getYouTubeId(video.filePath);
                    const isMutating = mutatingId === video.id;
                    return (
                        <Card key={video.id}>
                            <CardHeader>
                                <CardTitle className="truncate">{video.title}</CardTitle>
                                {video.description && <CardDescription className="line-clamp-3">{video.description}</CardDescription>}
                                {video.keywords && video.keywords.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-2">
                                        {video.keywords.map(kw => <Badge key={kw} variant="secondary">{kw}</Badge>)}
                                    </div>
                                )}
                            </CardHeader>
                            <CardContent>
                                {videoId ? (<iframe src={`https://www.youtube.com/embed/${videoId}`} title={video.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full rounded-md aspect-video"></iframe>) : (<div className="w-full rounded-md aspect-video bg-muted flex items-center justify-center"><p className="text-muted-foreground">Неверный URL видео</p></div>)}
                            </CardContent>
                            <CardFooter className="flex justify-end gap-2">
                                <Button variant="outline" disabled={isMutating} onClick={() => setEditingVideo(video)}>
                                    <Pencil className="mr-2 h-4 w-4" />Редактировать
                                </Button>
                                <Button variant="destructive" onClick={() => handleDelete(video)} disabled={isMutating}>
                                    {isMutating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                    Удалить
                                </Button>
                            </CardFooter>
                        </Card>
                    )
                })}
            </div>

            {editingVideo && (
                 <Dialog open={!!editingVideo} onOpenChange={(isOpen) => !isOpen && setEditingVideo(null)}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Редактировать видео</DialogTitle>
                            <DialogDescription>Внесите изменения в название, описание или ключевые слова видео.</DialogDescription>
                        </DialogHeader>
                        <EditVideoForm video={editingVideo} onFinish={() => setEditingVideo(null)} />
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
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
            deleteDoc(docRef).catch((serverError) => {
                 const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'delete',
                });
                errorEmitter.emit('permission-error', permissionError);
                toast({ variant: "destructive", title: "Ошибка отклонения", description: serverError.message });
            });

            toast({ title: "Видео отклонено и удалено", description: `"${video.title}" было полностью удалено.` });

        } catch (e: any) {
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
});


function AppearanceSettings() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const themeDocRef = useMemo(() => {
        if (!firestore) return null;
        return doc(firestore, 'site_settings', 'theme');
    }, [firestore]);

    const { data: themeSettings, loading, error } = useDoc(themeDocRef, { listen: true });

    const form = useForm<z.infer<typeof appearanceFormSchema>>({
        resolver: zodResolver(appearanceFormSchema),
    });

     useEffect(() => {
        if (themeSettings) {
            form.reset({
                primaryHex: themeSettings.primaryHex || '#8b5cf6',
                secondaryHex: themeSettings.secondaryHex || '#374151',
                backgroundHex: themeSettings.backgroundHex || '#111827',
                foregroundHex: themeSettings.foregroundHex || '#f8fafc',
                accentHex: themeSettings.accentHex || '#34d399',
                mutedHex: themeSettings.mutedHex || '#374151',
                destructiveHex: themeSettings.destructiveHex || '#ef4444',
                cardHex: themeSettings.cardHex || '#1f2937',
                borderHex: themeSettings.borderHex || '#374151',
                inputHex: themeSettings.inputHex || '#374151',
                ringHex: themeSettings.ringHex || '#8b5cf6',
                primaryForegroundHex: themeSettings.primaryForegroundHex || '#f8fafc',
                secondaryForegroundHex: themeSettings.secondaryForegroundHex || '#f9fafb',
                accentForegroundHex: themeSettings.accentForegroundHex || '#111827',
                mutedForegroundHex: themeSettings.mutedForegroundHex || '#9ca3af',
                destructiveForegroundHex: themeSettings.destructiveForegroundHex || '#f8fafc',
                cardForegroundHex: themeSettings.cardForegroundHex || '#f9fafb',
                popoverHex: themeSettings.popoverHex || '#111827',
                popoverForegroundHex: themeSettings.popoverForegroundHex || '#f9fafb',
            });
        }
    }, [themeSettings, form]);

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
    } as React.CSSProperties;

    async function onSubmit(values: z.infer<typeof appearanceFormSchema>) {
        if (!themeDocRef) return;
        setIsSubmitting(true);
        
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
        
        setDoc(themeDocRef, themeData, { merge: true })
            .then(() => {
                 toast({
                    title: "Настройки сохранены",
                    description: "Внешний вид сайта был успешно обновлен.",
                });
            })
            .catch((serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: themeDocRef.path,
                    operation: 'update',
                    requestResourceData: values,
                });
                errorEmitter.emit('permission-error', permissionError);
                toast({
                    variant: "destructive",
                    title: "Ошибка сохранения",
                    description: "Не удалось сохранить настройки темы. Проверьте права доступа в консоли Firebase.",
                });
            })
            .finally(() => {
                setIsSubmitting(false);
            });
    }

    if (loading) {
        return (
            <Card>
                <CardHeader><Skeleton className="h-8 w-1/3" /><Skeleton className="h-4 w-2/3 mt-2" /></CardHeader>
                <CardContent className="space-y-8">
                     <div className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <Separator />
                     <div className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                    <Skeleton className="h-10 w-32" />
                </CardContent>
            </Card>
        )
    }

    if (error) {
        return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Ошибка загрузки настроек</AlertTitle>
                <AlertDescription>
                    Не удалось получить данные темы. Проверьте права доступа к `site_settings/theme`.
                    <pre className="mt-2 text-xs bg-muted p-2 rounded">{error.message}</pre>
                </AlertDescription>
            </Alert>
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
                            <Input {...field} disabled={isSubmitting} className="pr-12" value={field.value || ''}/>
                            <Controller
                                name={name}
                                control={form.control}
                                render={({ field: { onChange, value } }) => (
                                    <input type="color" value={value || '#000000'} onChange={onChange} className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-10 p-1 rounded-md cursor-pointer border bg-card" />
                                )}
                            />
                        </div>
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );


    return (
        <Card>
            <CardHeader>
                <CardTitle>Внешний вид</CardTitle>
                <CardDescription>
                    Настройте цветовую схему для всего сайта. Изменения сразу отобразятся в панели предпросмотра.
                </CardDescription>
            </CardHeader>
            <CardContent>
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
                        
                        {/* --- PREVIEW PANEL --- */}
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
                                    <Button variant="link">Ссылка</Button>
                                     <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline">Поповер</Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-80">
                                            <div className="grid gap-4">
                                                <div className="space-y-2">
                                                    <h4 className="font-medium leading-none">Пример поповера</h4>
                                                    <p className="text-sm text-muted-foreground">
                                                       Это содержимое всплывающего окна.
                                                    </p>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                
                                <div>
                                    <Tabs defaultValue="account" className="w-full">
                                      <TabsList>
                                        <TabsTrigger value="account">Аккаунт</TabsTrigger>
                                        <TabsTrigger value="password">Пароль</TabsTrigger>
                                      </TabsList>
                                      <TabsContent value="account" className="border rounded-md p-4">
                                        Это содержимое вкладки "Аккаунт".
                                      </TabsContent>
                                      <TabsContent value="password">
                                        Это содержимое вкладки "Пароль".
                                      </TabsContent>
                                    </Tabs>
                                </div>

                                <div>
                                    <FormLabel htmlFor="preview-input">Поле ввода</FormLabel>
                                    <Input id="preview-input" placeholder="Введите текст..."/>
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
            </CardContent>
        </Card>
    )
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
            <TabsTrigger value="management">Управление</TabsTrigger>
            <TabsTrigger value="appearance">Внешний вид</TabsTrigger>
        </TabsList>
        <TabsContent value="moderation" className="mt-6">
            <PendingVideosList />
        </TabsContent>
        <TabsContent value="management" className="mt-6">
            <PublicVideosList />
        </TabsContent>
        <TabsContent value="appearance" className="mt-6">
            <AppearanceSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
