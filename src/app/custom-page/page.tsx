'use client';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemo, useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

function CustomPageViewer() {
    const firestore = useFirestore();
    const [sanitizedHtml, setSanitizedHtml] = useState('');

    const customPageRef = useMemo(() => {
        if (!firestore) return null;
        return doc(firestore, 'customPages', 'main');
    }, [firestore]);

    const { data, loading, error } = useDoc(customPageRef, { listen: true });

    useEffect(() => {
        if (data?.html) {
            // We need a window object for DOMPurify to work on the server.
            // This setup is safe because we are creating a temporary, isolated DOM.
            const window = new JSDOM('').window;
            const purify = DOMPurify(window as any);
            setSanitizedHtml(purify.sanitize(data.html));
        } else {
            setSanitizedHtml('');
        }
    }, [data?.html]);


    if (loading) {
        return (
            <div className="p-8 space-y-4">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="container mx-auto px-4 py-8">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Ошибка загрузки</AlertTitle>
                    <AlertDescription>
                       Не удалось загрузить содержимое страницы. Проверьте права доступа.
                       <pre className="mt-2 text-xs bg-muted p-2 rounded">{error.message}</pre>
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    const htmlContent = sanitizedHtml || '<p class="text-muted-foreground">Содержимое еще не создано. Перейдите в панель администратора, чтобы добавить его.</p>';
    const cssContent = data?.css || '';

    return (
        <div className="container mx-auto px-4 py-8">
            <style jsx global>{cssContent}</style>
            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
        </div>
    );
}

export default function CustomPage() {
    return <CustomPageViewer />;
}
