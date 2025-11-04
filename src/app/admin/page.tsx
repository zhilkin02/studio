'use client';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { collection, query, orderBy, doc, getDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Check, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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


interface PendingVideo {
    id: string;
    title: string;
    description: string;
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

    // Note: useCollection's data is read-only. We need `setData` for optimistic updates.
    const { data: videos, loading, error, setData } = useCollection(pendingQuery, { listen: true });


    const handleApprove = async (video: PendingVideo) => {
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
             if (setData) {
              setData(currentVideos => currentVideos?.filter(v => v.id !== video.id) ?? null);
            }

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

    const handleReject = async (video: PendingVideo) => {
        if (!firestore) return;
        setMutatingId(video.id);

        try {
            // We only need to delete the Firestore document.
            // The video remains on YouTube as 'unlisted' but is gone from our app.
            const pendingDocRef = doc(firestore, 'pendingVideoFragments', video.id);
            await deleteDoc(pendingDocRef);

            toast({
                title: "Видео отклонено",
                description: `"${video.title}" было удалено из очереди модерации.`,
            });
            // Optimistic UI update
            if (setData) {
              setData(currentVideos => currentVideos?.filter(v => v.id !== video.id) ?? null);
            }

        } catch (e: any) {
            console.error("Error rejecting video:", e);
             toast({
                variant: "destructive",
                title: "Ошибка отклонения",
                description: "Не удалось удалить запись из базы данных."
            });
        } finally {
            setMutatingId(null);
        }
    };


    if (loading) {
        return (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(2)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader>
                            <Skeleton className="h-6 w-3/4 mb-2" />
                            <Skeleton className="h-4 w-full" />
                        </CardHeader>
                        <CardContent>
                             <Skeleton className="w-full h-auto aspect-video rounded-md" />
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2">
                            <Skeleton className="h-10 w-24" />
                            <Skeleton className="h-10 w-24" />
                        </CardFooter>
                    </Card>
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
                <p className="text-muted-foreground mt-2">
                    Нет видео, ожидающих модерации.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(videos as PendingVideo[]).map((video) => {
                const videoId = getYouTubeId(video.filePath);
                return (
                    <Card key={video.id}>
                        <CardHeader>
                            <CardTitle className="truncate">{video.title}</CardTitle>
                            <CardDescription className="line-clamp-3">{video.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {videoId ? (
                                <iframe
                                    src={`https://www.youtube.com/embed/${videoId}`}
                                    title={video.title}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    className="w-full rounded-md aspect-video"
                                ></iframe>
                            ) : (
                                <div className="w-full rounded-md aspect-video bg-muted flex items-center justify-center">
                                    <p className="text-muted-foreground">Неверный URL видео</p>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2">
                            <Button 
                                variant="outline" 
                                onClick={() => handleReject(video)}
                                disabled={mutatingId === video.id}
                            >
                                {mutatingId === video.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                                Отклонить
                            </Button>
                             <Button 
                                onClick={() => handleApprove(video)}
                                disabled={mutatingId === video.id}
                             >
                                {mutatingId === video.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                Одобрить
                             </Button>
                        </CardFooter>
                    </Card>
                )
            })}
        </div>
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
        return <div className="flex justify-center items-center min-h-[calc(100vh-12rem)]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
            <p className="ml-4 text-muted-foreground">Проверка прав доступа...</p>
        </div>;
    }


  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Панель администратора</h1>
        <p className="text-muted-foreground">
           Управление видеофрагментами, ожидающими модерации.
        </p>
      </div>
      <PendingVideosList />
    </div>
  );
}
