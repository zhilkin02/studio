'use client';

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, Search, AlertCircle, Trash2, Pencil, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { collection, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore } from '@/firebase';
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import React, { useState, useMemo } from "react";
import { EditableText } from "@/components/editable-text";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/firebase/auth/use-user";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from "@/components/ui/textarea";
import { deleteVideoFromYouTube } from "@/ai/flows/youtube-delete-flow";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useDoc } from "@/firebase/firestore/use-doc";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import Image from 'next/image';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Link from "next/link";

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

interface VideoFragment {
    id: string;
    title: string;
    description: string;
    filePath: string; // This will be a YouTube URL
    keywords?: string[];
    uploaderId?: string; // Add this to satisfy the EditVideoForm video prop
}

function EditVideoForm({ video, onFinish }: { video: VideoFragment, onFinish: () => void }) {
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

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [editingVideo, setEditingVideo] = useState<VideoFragment | null>(null);

  const videosQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'publicVideoFragments'), orderBy('uploadDate', 'desc'));
  }, [firestore]);

  const { data: videos, loading, error } = useCollection(videosQuery);
  const contentDocRef = useMemo(() => firestore ? doc(firestore, 'site_content', 'main') : null, [firestore]);
  const { data: content, loading: contentLoading } = useDoc(contentDocRef, { listen: true });
  
  const heroImageUrl = content?.heroImageUrl || PlaceHolderImages.find(p => p.id === 'hero-1')?.imageUrl;
  const heroImageObjectFit = content?.heroImageObjectFit || 'cover';
  const heroImageObjectPosition = content?.heroImageObjectPosition || 'center';


  const filteredVideos = useMemo(() => {
    if (!videos) return [];
    if (!searchQuery) return videos;
    
    const lowercasedQuery = searchQuery.toLowerCase();

    return (videos as VideoFragment[]).filter(video => {
        const titleMatch = video.title.toLowerCase().includes(lowercasedQuery);
        const descriptionMatch = video.description && video.description.toLowerCase().includes(lowercasedQuery);
        const keywordsMatch = video.keywords && video.keywords.some(kw => kw.toLowerCase().includes(lowercasedQuery));
        return titleMatch || descriptionMatch || keywordsMatch;
    });
  }, [videos, searchQuery]);
  
  const handleDelete = async (video: VideoFragment) => {
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
        
        await deleteDoc(docRef);

        toast({ title: "Видео удалено", description: `"${video.title}" было полностью удалено.` });

    } catch (e: any) {
         const permissionError = new FirestorePermissionError({
            path: `publicVideoFragments/${video.id}`,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        console.error("Error deleting video:", e);
        toast({ variant: "destructive", title: "Ошибка удаления", description: e.message || "Произошла неизвестная ошибка." });
    } finally {
        setMutatingId(null);
    }
  };


  return (
    <>
      <section className="relative w-full h-48 md:h-64 -mx-4 sm:mx-0">
          {contentLoading || !heroImageUrl ? <Skeleton className="w-full h-full" /> : (
                <Image
                  src={heroImageUrl}
                  alt="Hero image"
                  fill
                  style={{ 
                      objectFit: heroImageObjectFit as 'cover' | 'contain' | 'fill' | 'none' | 'scale-down', 
                      objectPosition: heroImageObjectPosition 
                  }}
                  priority
                  data-ai-hint="retro tv"
              />
          )}
      </section>
      <div className="container mx-auto px-4 pb-8">
        <section className="text-center py-8">
            <EditableText
              docPath="site_content/main"
              fieldKey="header_title"
              defaultValue="Коротко О Не Коротком"
              render={(text) => <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 whitespace-pre-wrap">{text}</h1>}
              textarea={true}
            />
            <EditableText
              docPath="site_content/main"
              fieldKey="home_subtitle"
              defaultValue="Найдите идеальный фрагмент из фильма или сериала за секунды."
              render={(text) => <p className="text-lg md:text-xl text-muted-foreground mb-8 whitespace-pre-wrap">{text}</p>}
              textarea={true}
            />
        </section>
      
      <section className="mb-12">
          <div className="max-w-2xl mx-auto flex gap-2">
            <Input
                type="search"
                placeholder="Введите ключевые слова, название фильма или описание..."
                className="flex-grow"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button type="button">
                <Search className="mr-2 h-4 w-4" /> Поиск
            </Button>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-6">Недавно добавленные</h2>
        
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="p-0">
                  <Skeleton className="w-full h-auto aspect-video rounded-t-lg" />
                </CardHeader>
                <CardContent className="pt-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
                <CardFooter>
                    <Skeleton className="h-10 w-28" />
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {error && (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Ошибка загрузки видео</AlertTitle>
                <AlertDescription>
                    Не удалось получить данные из базы. Пожалуйста, проверьте правила безопасности Firestore.
                    <pre className="mt-2 text-xs bg-muted p-2 rounded">{error.message}</pre>
                </AlertDescription>
            </Alert>
        )}

        {!loading && !error && filteredVideos.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed rounded-lg bg-muted/50">
            <h3 className="text-xl font-semibold text-foreground">
              {searchQuery ? 'Ничего не найдено' : 'Видео пока нет'}
            </h3>
            <p className="text-muted-foreground mt-2">
              {searchQuery ? 'Попробуйте изменить поисковый запрос.' : 'В данный момент нет одобренных видео. Первый ролик скоро появится!'}
            </p>
          </div>
        )}

        {!loading && !error && filteredVideos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(filteredVideos as VideoFragment[]).map((video) => {
                const videoId = getYouTubeId(video.filePath);
                const isMutating = mutatingId === video.id;
                const downloadUrl = `https://www.y2mate.com/youtube/${videoId}`;

                return (
                  <Card key={video.id} className="flex flex-col">
                    <CardHeader className="p-0">
                      {videoId ? (
                            <iframe
                                src={`https://www.youtube.com/embed/${videoId}`}
                                title={video.title}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="w-full rounded-t-lg aspect-video"
                            ></iframe>
                        ) : (
                            <div className="w-full rounded-t-lg aspect-video bg-muted flex items-center justify-center">
                              <p className="text-muted-foreground text-sm">Неверный формат видео</p>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="pt-4 flex-grow">
                      <h3 className="font-semibold text-lg truncate">{video.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{video.description}</p>
                       {video.keywords && video.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {video.keywords.map((keyword) => (
                            <Badge key={keyword} variant="secondary">{keyword}</Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex justify-between items-center">
                        <Button variant="secondary" className="w-full" asChild>
                            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                                <Download className="mr-2 h-4 w-4" />
                                Скачать
                            </a>
                        </Button>
                         {user?.isAdmin && (
                            <div className="flex gap-2 ml-2">
                                <Button variant="outline" size="icon" disabled={isMutating} onClick={() => setEditingVideo(video)}>
                                    <Pencil className="h-4 w-4" />
                                    <span className="sr-only">Редактировать</span>
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="icon" disabled={isMutating}>
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Удалить</span>
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Вы абсолютно уверены?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Это действие необратимо. Видео будет удалено с YouTube и из базы данных.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(video)} disabled={isMutating}>
                                                 {isMutating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                Удалить
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        )}
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
        )}
      </section>

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
    </div>
    </>
  );
}