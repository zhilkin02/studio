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
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Check, X, Loader2, Trash2, Pencil, Palette, UploadCloud, Image } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteVideoFromYouTube } from '@/ai/flows/youtube-delete-flow';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Separator } from '@/components/ui/separator';

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
  description: z.string().min(10, 'Описание должно быть не менее 10 символов.').max(5000, 'Описание должно быть не более 5000 символов.'),
});


interface Video {
    id: string;
    title: string;
    description: string;
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
            description: video.description,
        },
    });

    async function onSubmit(values: z.infer<typeof editFormSchema>) {
        if (!firestore) return;
        setIsSubmitting(true);

        const docRef = doc(firestore, 'publicVideoFragments', video.id);
        const data = {
            title: values.title,
            description: values.description,
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
                            <FormLabel>Описание</FormLabel>
                            <FormControl>
                                <Textarea className="resize-y" {...field} disabled={isSubmitting} />
                            </FormControl>
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


    const publicQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'publicVideoFragments'), orderBy('uploadDate', 'desc'));
    }, [firestore]);

    const { data: videos, loading, error } = useCollection(publicQuery, { listen: true });

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

    if (!videos || videos.length === 0) {
        return (
            <div className="text-center py-16 border-2 border-dashed rounded-lg bg-muted/50">
                <h3 className="text-xl font-semibold text-foreground">Нет опубликованных видео</h3>
                <p className="text-muted-foreground mt-2">После одобрения они появятся здесь.</p>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(videos as Video[]).map((video) => {
                    const videoId = getYouTubeId(video.filePath);
                    const isMutating = mutatingId === video.id;
                    return (
                        <Card key={video.id}>
                            <CardHeader>
                                <CardTitle className="truncate">{video.title}</CardTitle>
                                <CardDescription className="line-clamp-3">{video.description}</CardDescription>
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
                            <DialogDescription>Внесите изменения в название или описание видео.</DialogDescription>
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
                            <CardDescription className="line-clamp-3">{video.description}</CardDescription>
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

const appearanceFormSchema = z.object({
  primary: z.string().regex(/^#[0-9a-f]{6}$/i, 'Неверный HEX формат.'),
  background: z.string().regex(/^#[0-9a-f]{6}$/i, 'Неверный HEX формат.'),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i, 'Неверный HEX формат.'),
  headerImageUrl: z.string().url().optional().or(z.literal('')),
  mainImageUrl: z.string().url().optional().or(z.literal('')),
  footerImageUrl: z.string().url().optional().or(z.literal('')),
});


function AppearanceSettings() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [imageUploading, setImageUploading] = useState<string | null>(null);
    
    const themeDocRef = useMemo(() => {
        if (!firestore) return null;
        return doc(firestore, 'site_settings', 'theme');
    }, [firestore]);

    const { data: themeSettings, loading, error } = useDoc(themeDocRef, { listen: true });

    const form = useForm<z.infer<typeof appearanceFormSchema>>({
        resolver: zodResolver(appearanceFormSchema),
        values: {
            primary: themeSettings?.primary || '#8b5cf6',
            background: themeSettings?.background || '#111827',
            accent: themeSettings?.accent || '#34d399',
            headerImageUrl: themeSettings?.headerImageUrl || '',
            mainImageUrl: themeSettings?.mainImageUrl || '',
            footerImageUrl: themeSettings?.footerImageUrl || '',
        },
    });

    useEffect(() => {
        if (themeSettings) {
            form.reset({
                primary: themeSettings.primary || '#8b5cf6',
                background: themeSettings.background || '#111827',
                accent: themeSettings.accent || '#34d399',
                headerImageUrl: themeSettings.headerImageUrl || '',
                mainImageUrl: themeSettings.mainImageUrl || '',
                footerImageUrl: themeSettings.footerImageUrl || '',
            });
        }
    }, [themeSettings, form]);

    const handleImageUpload = async (file: File, fieldName: 'headerImageUrl' | 'mainImageUrl' | 'footerImageUrl') => {
        const storage = getStorage();
        setImageUploading(fieldName);
        const imageRef = storageRef(storage, `theme/${fieldName}_${Date.now()}_${file.name}`);
        
        try {
            const snapshot = await uploadBytes(imageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            form.setValue(fieldName, downloadURL, { shouldValidate: true });
            toast({ title: 'Изображение загружено', description: 'URL был добавлен в форму.' });
        } catch (e: any) {
             toast({ variant: 'destructive', title: 'Ошибка загрузки изображения', description: e.message });
        } finally {
            setImageUploading(null);
        }
    }

    async function onSubmit(values: z.infer<typeof appearanceFormSchema>) {
        if (!themeDocRef) return;
        setIsSubmitting(true);
        
        const themeData = {
            ...values,
            primary: hexToHsl(values.primary),
            background: hexToHsl(values.background),
            accent: hexToHsl(values.accent),
        }
        
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
                    operation: 'write',
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
                <CardHeader><CardTitle>Внешний вид</CardTitle><CardDescription>Настройте цветовую схему и фоновые изображения сайта.</CardDescription></CardHeader>
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

    const ImageUploader = ({ fieldName, label }: { fieldName: 'headerImageUrl' | 'mainImageUrl' | 'footerImageUrl', label: string }) => {
        const currentUrl = form.watch(fieldName);
        return (
             <FormItem>
                <FormLabel>{label}</FormLabel>
                <FormControl>
                    <div className="relative border-2 border-dashed border-muted-foreground/50 rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors flex flex-col items-center justify-center min-h-[120px]">
                       {currentUrl ? (
                         <>
                            <img src={currentUrl} alt={label} className="max-h-24 rounded-md mb-2 object-cover"/>
                            <p className="text-xs text-muted-foreground truncate max-w-full">{currentUrl}</p>
                             <Button variant="link" size="sm" className="mt-1 text-red-500" onClick={() => form.setValue(fieldName, '')}>Удалить</Button>
                         </>
                       ) : (
                         <>
                           <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground"/>
                            <p className="mt-2 text-sm text-muted-foreground">
                                {imageUploading === fieldName ? 'Загрузка...' : 'Нажмите, чтобы выбрать файл'}
                            </p>
                         </>
                       )}
                      <Input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], fieldName)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={isSubmitting || !!imageUploading}
                      />
                    </div>
                </FormControl>
                <FormMessage />
            </FormItem>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Внешний вид</CardTitle>
                <CardDescription>
                    Настройте цветовую схему и фоновые изображения для сайта.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        <div>
                             <h3 className="text-lg font-medium mb-4">Цветовая схема</h3>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <FormField
                                    control={form.control}
                                    name="primary"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Основной</FormLabel>
                                            <FormControl>
                                                 <div className="relative">
                                                    <Input {...field} disabled={isSubmitting} className="pr-12" />
                                                    <Controller
                                                        name="primary"
                                                        control={form.control}
                                                        render={({ field: { onChange, value } }) => (
                                                            <input type="color" value={value} onChange={onChange} className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-10 p-1 rounded-md cursor-pointer border bg-card" />
                                                        )}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="background"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Фон</FormLabel>
                                            <FormControl>
                                                 <div className="relative">
                                                    <Input {...field} disabled={isSubmitting} className="pr-12" />
                                                    <Controller
                                                        name="background"
                                                        control={form.control}
                                                        render={({ field: { onChange, value } }) => (
                                                            <input type="color" value={value} onChange={onChange} className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-10 p-1 rounded-md cursor-pointer border bg-card" />
                                                        )}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="accent"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Акцент</FormLabel>
                                            <FormControl>
                                                 <div className="relative">
                                                    <Input {...field} disabled={isSubmitting} className="pr-12" />
                                                    <Controller
                                                        name="accent"
                                                        control={form.control}
                                                        render={({ field: { onChange, value } }) => (
                                                            <input type="color" value={value} onChange={onChange} className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-10 p-1 rounded-md cursor-pointer border bg-card" />
                                                        )}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                             </div>
                        </div>

                        <Separator />

                        <div>
                             <h3 className="text-lg font-medium mb-4">Фоновые изображения</h3>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <ImageUploader fieldName="headerImageUrl" label="Изображение шапки"/>
                                <ImageUploader fieldName="mainImageUrl" label="Изображение контента"/>
                                <ImageUploader fieldName="footerImageUrl" label="Изображение подвала"/>
                              </div>
                        </div>


                        <Button type="submit" disabled={isSubmitting || !!imageUploading}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {imageUploading ? 'Дождитесь загрузки...' : 'Сохранить'}
                        </Button>
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
