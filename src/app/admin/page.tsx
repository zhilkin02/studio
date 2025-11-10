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
import { AlertCircle, Check, X, Loader2, Users, User, Shield, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteVideoFromYouTube } from '@/ai/flows/youtube-delete-flow';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


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

function SiteContentEditor() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const docRef = useMemo(() => firestore ? doc(firestore, 'site_content', 'main') : null, [firestore]);
    const { data: content, loading } = useDoc(docRef);

    const [formData, setFormData] = useState({
        heroImageUrl: '',
        heroImageObjectFit: 'cover',
        heroImageObjectPosition: 'center'
    });

    useEffect(() => {
        if (content) {
            setFormData({
                heroImageUrl: content.heroImageUrl || '',
                heroImageObjectFit: content.heroImageObjectFit || 'cover',
                heroImageObjectPosition: content.heroImageObjectPosition || 'center'
            });
        }
    }, [content]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string) => (value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleSave = async () => {
        if (!docRef) return;
        setIsSubmitting(true);
        const dataToSave = {
            heroImageUrl: formData.heroImageUrl,
            heroImageObjectFit: formData.heroImageObjectFit,
            heroImageObjectPosition: formData.heroImageObjectPosition,
        };

        try {
            await setDoc(docRef, dataToSave, { merge: true });
            toast({
                title: 'Контент обновлен!',
                description: 'Изменения на сайте были успешно сохранены.',
            });
        } catch (e: any) {
             const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'update',
                requestResourceData: dataToSave,
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Ошибка сохранения', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (loading) {
        return <Skeleton className="h-[400px] w-full" />
    }
    
    const objectFitOptions = ['cover', 'contain', 'fill', 'none', 'scale-down'];
    const objectPositionOptions = ['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right'];


    return (
         <Card>
            <CardHeader>
                <CardTitle>Контент на главной</CardTitle>
                <CardDescription>
                    Измените фоновое изображение и его отображение на главной странице. Текстовые поля редактируются прямо на самой странице.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="heroImageUrl">URL главного изображения</Label>
                    <Input id="heroImageUrl" name="heroImageUrl" value={formData.heroImageUrl} onChange={handleChange} placeholder="https://images.unsplash.com/..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="heroImageObjectFit">Растягивание (object-fit)</Label>
                        <Select value={formData.heroImageObjectFit} onValueChange={handleSelectChange('heroImageObjectFit')}>
                            <SelectTrigger>
                                <SelectValue placeholder="Выберите значение" />
                            </SelectTrigger>
                            <SelectContent>
                                {objectFitOptions.map(option => (
                                    <SelectItem key={option} value={option}>{option}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="heroImageObjectPosition">Позиция (object-position)</Label>
                        <Select value={formData.heroImageObjectPosition} onValueChange={handleSelectChange('heroImageObjectPosition')}>
                            <SelectTrigger>
                                <SelectValue placeholder="Выберите значение" />
                            </SelectTrigger>
                            <SelectContent>
                                {objectPositionOptions.map(option => (
                                    <SelectItem key={option} value={option}>{option}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleSave} disabled={isSubmitting}>
                     {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Сохранить контент
                </Button>
            </CardFooter>
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
        <p className="text-muted-foreground">Управление контентом и пользователями проекта.</p>
      </div>

      <Tabs defaultValue="moderation" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="moderation">Модерация</TabsTrigger>
            <TabsTrigger value="users">Пользователи</TabsTrigger>
            <TabsTrigger value="content"><FileText className="mr-2 h-4 w-4" />Контент</TabsTrigger>
        </TabsList>
        <TabsContent value="moderation" className="mt-6">
            <PendingVideosList />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
            <UserManagement />
        </TabsContent>
         <TabsContent value="content" className="mt-6">
            <SiteContentEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
