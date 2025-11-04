'use client';

import { useMemo } from 'react';
import { collection, query, orderBy, Firestore } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface VideoFragment {
  id: string;
  title: string;
  description: string;
  filePath: string;
  uploaderId: string;
  uploadDate: {
    seconds: number;
  };
  status: string;
}

function ApprovedVideos() {
  const firestore = useFirestore() as Firestore;

  const videosQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "publicVideoFragments"), orderBy("uploadDate", "desc"));
  }, [firestore]);

  const { data: videos, isLoading, error } = useCollection<VideoFragment>(videosQuery);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
           <Card key={i}>
             <CardContent className="p-0">
                <div className="w-full bg-muted aspect-video rounded-t-lg animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="w-3/4 h-6 bg-muted rounded animate-pulse" />
                  <div className="w-full h-4 bg-muted rounded animate-pulse" />
                </div>
             </CardContent>
           </Card>
        ))}
      </div>
    );
  }
  
  if (error) {
     return <p className="text-destructive">Ошибка загрузки видео: {error.message}</p>;
  }

  if (!videos || videos.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground">Одобренных видеоклипов пока нет.</p>
        <p className="text-sm text-muted-foreground">Загрузите видео и одобрите его в админ-панели, чтобы оно появилось здесь.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {videos.map((video) => (
        <Card key={video.id}>
          <CardHeader className="p-0">
            <video controls src={video.filePath} className="w-full rounded-t-lg aspect-video" preload="metadata" />
          </CardHeader>
          <CardContent className="pt-4">
            <h3 className="font-semibold text-lg truncate">{video.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{video.description}</p>
          </CardContent>
        </Card>
      ))}
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
