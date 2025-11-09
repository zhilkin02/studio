'use client';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { doc, setDoc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

export default function CustomCodeEditorPage() {
    const { user, loading: userLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [htmlContent, setHtmlContent] = useState('');
    const [cssContent, setCssContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sanitizedPreviewHtml, setSanitizedPreviewHtml] = useState('');

    const customPageRef = useMemo(() => {
        if (!firestore) return null;
        return doc(firestore, 'customPages', 'main');
    }, [firestore]);

    const { data: initialData, loading: dataLoading, error } = useDoc(customPageRef, { listen: false });

    useEffect(() => {
        if (!userLoading) {
            if (!user) {
                router.push('/login');
            } else if (!user.isAdmin) {
                router.push('/');
            }
        }
    }, [user, userLoading, router]);

    useEffect(() => {
        if (initialData) {
            setHtmlContent(initialData.html || '');
            setCssContent(initialData.css || '');
        }
    }, [initialData]);

     useEffect(() => {
        // Sanitize HTML for preview on the client side
        const window = new JSDOM('').window;
        const purify = DOMPurify(window as any);
        setSanitizedPreviewHtml(purify.sanitize(htmlContent));
    }, [htmlContent]);


    const handleSave = async () => {
        if (!customPageRef) return;
        setIsSubmitting(true);

        const data = {
            html: htmlContent,
            css: cssContent
        };

        setDoc(customPageRef, data, { merge: true })
            .then(() => {
                toast({
                    title: "Сохранено!",
                    description: "Ваши изменения были успешно сохранены.",
                });
            })
            .catch((serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: customPageRef.path,
                    operation: 'update',
                    requestResourceData: data,
                });
                errorEmitter.emit('permission-error', permissionError);
                toast({
                    variant: "destructive",
                    title: "Ошибка сохранения",
                    description: serverError.message || "Не удалось сохранить изменения.",
                });
            })
            .finally(() => {
                setIsSubmitting(false);
            });
    };

    if (userLoading || dataLoading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-10rem)]">
                    <Card><CardHeader><Skeleton className="h-6 w-1/3 mb-2" /><Skeleton className="h-4 w-2/3" /></CardHeader><CardContent><Skeleton className="w-full h-64" /></CardContent></Card>
                    <Card><CardHeader><Skeleton className="h-6 w-1/3 mb-2" /></CardHeader><CardContent><Skeleton className="w-full h-64" /></CardContent></Card>
                </div>
            </div>
        );
    }
     if (error) {
        return (
             <div className="container mx-auto px-4 py-8">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Ошибка загрузки данных</AlertTitle>
                    <AlertDescription>
                        Не удалось получить данные для редактирования. Проверьте права доступа к `customPages/main`.
                        <pre className="mt-2 text-xs bg-muted p-2 rounded">{error.message}</pre>
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
             <div className="mb-6 flex justify-between items-center">
                <div>
                     <h1 className="text-3xl font-bold tracking-tight">Редактор кода</h1>
                     <p className="text-muted-foreground">Измените HTML и CSS и сразу увидьте результат.</p>
                </div>
                <Button onClick={handleSave} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Сохранить
                </Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-12rem)]">
                <div className="flex flex-col gap-4">
                    <Card className="flex-1 flex flex-col">
                        <CardHeader>
                            <CardTitle>HTML</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <Textarea
                                placeholder="<h1 class='text-2xl'>Привет, мир!</h1>"
                                value={htmlContent}
                                onChange={(e) => setHtmlContent(e.target.value)}
                                className="w-full h-full resize-none font-mono"
                                disabled={isSubmitting}
                            />
                        </CardContent>
                    </Card>
                    <Card className="flex-1 flex flex-col">
                        <CardHeader>
                            <CardTitle>CSS</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1">
                             <Textarea
                                placeholder=".my-class { color: red; }"
                                value={cssContent}
                                onChange={(e) => setCssContent(e.target.value)}
                                className="w-full h-full resize-none font-mono"
                                disabled={isSubmitting}
                            />
                        </CardContent>
                    </Card>
                </div>

                <Card className="h-full overflow-auto">
                    <CardHeader>
                        <CardTitle>Предпросмотр</CardTitle>
                         <CardDescription>Изменения применяются в реальном времени.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <style jsx global>{`
                            #preview-container h1 { font-size: 2em; font-weight: bold; }
                            #preview-container h2 { font-size: 1.5em; font-weight: bold; }
                            #preview-container p { margin-bottom: 1rem; }
                            #preview-container a { color: hsl(var(--primary)); text-decoration: underline; }
                            ${cssContent}
                        `}</style>
                        <div id="preview-container" dangerouslySetInnerHTML={{ __html: sanitizedPreviewHtml }} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
