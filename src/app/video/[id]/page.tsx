'use client';
import { useDoc } from "@/firebase/firestore/use-doc";
import { useFirestore } from "@/firebase";
import { doc } from "firebase/firestore";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Film, Tag, Clapperboard, MicVocal, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Helper to extract YouTube video ID from URL
const getYouTubeId = (url: string) => {
    if (!url) return null;
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


export default function VideoDetailPage() {
    const { id } = useParams();
    const firestore = useFirestore();

    const videoId = typeof id === 'string' ? id : '';
    const videoRef = useMemo(() => {
        if (!firestore || !videoId) return null;
        return doc(firestore, 'publicVideoFragments', videoId);
    }, [firestore, videoId]);

    const { data: video, loading, error } = useDoc(videoRef, { listen: false });

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <Skeleton className="w-full aspect-video rounded-lg" />
                <div className="mt-6">
                    <Skeleton className="h-8 w-3/4 mb-4" />
                    <Skeleton className="h-6 w-1/2 mb-8" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                </div>
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
                        Не удалось загрузить данные для этого видео.
                        <pre className="mt-2 text-xs bg-muted p-2 rounded">{error.message}</pre>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    if (!video) {
        return (
             <div className="container mx-auto px-4 py-8 text-center">
                 <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Видео не найдено</AlertTitle>
                    <AlertDescription>
                        К сожалению, видео с таким идентификатором не существует.
                    </AlertDescription>
                </Alert>
                <Button asChild className="mt-6">
                    <Link href="/">Вернуться на главную</Link>
                </Button>
            </div>
        )
    }

    const videoIdFromUrl = getYouTubeId(video.filePath);

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            {videoIdFromUrl && (
                 <div className="aspect-video mb-6">
                    <iframe
                        src={`https://www.youtube.com/embed/${videoIdFromUrl}`}
                        title={video.phrase}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full rounded-lg"
                    ></iframe>
                </div>
            )}
           
            <div className="mb-6">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">"{video.phrase}"</h1>
                <p className="text-lg text-muted-foreground mt-2">из «{video.sourceName}»</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {video.sourceDetails && <InfoCard icon={Film} title="Сезон и серия / Часть" value={video.sourceDetails} />}
                {video.voiceOver && <InfoCard icon={MicVocal} title="Озвучка" value={video.voiceOver} />}
                {video.timestampInSource && <InfoCard icon={Clock} title="Время в источнике" value={video.timestampInSource} />}
            </div>

            {video.keywords && video.keywords.length > 0 && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Tag className="h-5 w-5 text-primary" />
                            Ключевые слова
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {video.keywords.map((keyword: string) => (
                                <Badge key={keyword} variant="secondary" className="text-base font-normal">
                                    {keyword}
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

             <div className="mt-8 flex justify-center">
                <Button asChild size="lg">
                    <Link href="/">Вернуться на главную</Link>
                </Button>
             </div>
        </div>
    )
}

interface InfoCardProps {
    icon: React.ElementType;
    title: string;
    value: string;
}

function InfoCard({ icon: Icon, title, value }: InfoCardProps) {
    return (
        <Card className="flex items-start p-4">
            <div className="bg-muted p-2 rounded-md mr-4">
                 <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
                <p className="text-sm text-muted-foreground">{title}</p>
                <p className="font-semibold">{value}</p>
            </div>
        </Card>
    );
}