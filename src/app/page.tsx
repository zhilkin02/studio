'use client';

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, Search, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { collection, query, orderBy } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore } from '@/firebase';
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import React from "react";

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

interface VideoFragment {
    id: string;
    title: string;
    description: string;
    filePath: string; // This will be a YouTube URL
}


function ApprovedVideos() {
  const firestore = useFirestore();
  const videosQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'publicVideoFragments'), orderBy('uploadDate', 'desc'));
  }, [firestore]);

  const { data: videos, loading, error } = useCollection(videosQuery);

  if (loading) {
    return (
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
    );
  }

  if (error) {
    return (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Ошибка загрузки видео</AlertTitle>
            <AlertDescription>
                Не удалось получить данные из базы. Пожалуйста, проверьте правила безопасности Firestore.
                <pre className="mt-2 text-xs bg-muted p-2 rounded">{error.message}</pre>
            </AlertDescription>
        </Alert>
    )
  }

  if (!videos || videos.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-lg bg-muted/50">
        <h3 className="text-xl font-semibold text-foreground">Видео пока нет</h3>
        <p className="text-muted-foreground mt-2">
          В данный момент нет одобренных видео. Первый ролик скоро появится!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {(videos as VideoFragment[]).map((video) => {
        const videoId = getYouTubeId(video.filePath);
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
            </CardContent>
            <CardFooter>
                 {videoId && (
                     <Button asChild variant="secondary" className="w-full">
                        <a href={`https://www.ssyoutube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer">
                            <Download className="mr-2 h-4 w-4" />
                            Скачать
                        </a>
                    </Button>
                 )}
            </CardFooter>
          </Card>
        )
      })}
    </div>
  );
}


export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
        <section className="text-center py-16">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            Коротко О Не Коротком
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8">
            Найдите идеальный фрагмент из фильма или сериала за секунды.
            </p>
        </section>
      
      <section className="mb-12">
          <div className="max-w-2xl mx-auto flex gap-2">
            <Input
                type="search"
                placeholder="Введите ключевые слова, название фильма или описание..."
                className="flex-grow"
            />
            <Button type="submit">
                <Search className="mr-2 h-4 w-4" /> Поиск
            </Button>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-6">Недавно добавленные</h2>
        <ApprovedVideos />
      </section>
    </div>
  );
}
