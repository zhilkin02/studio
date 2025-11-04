'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

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
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const approvedVideosQuery = useMemoFirebase(() => {
    // CRITICAL: Only create the query if the user is loaded AND logged in.
    if (isUserLoading || !user || !firestore) return null;
    return query(collection(firestore, "videoFragments"), orderBy("uploadDate", "desc"));
  }, [firestore, user, isUserLoading]);

  // The hook will now receive `null` and wait if the user is not logged in.
  const { data: videos, isLoading, error } = useCollection<VideoFragment>(approvedVideosQuery);

  if (isUserLoading) {
    return <div className="text-center py-16"><p className="text-muted-foreground">Загрузка...</p></div>;
  }
  
  if (!user) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground mb-2">Пожалуйста, войдите, чтобы просмотреть видео.</p>
        <Button asChild>
          <Link href="/login">Войти</Link>
        </Button>
      </div>
    );
  }
  
  if (isLoading) {
    return <div className="text-center py-16"><p className="text-muted-foreground">Загрузка клипов...</p></div>;
  }

  if (error) {
    // This error should now only appear for logged-in users if there's a real issue.
    return <div className="text-center py-16"><p className="text-destructive">Ошибка загрузки: {error.message}</p></div>;
  }

  if (!videos || videos.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground">Одобренных видеоклипов пока нет.</p>
        <p className="text-sm text-muted-foreground">Загрузите видео и одобрите его в админ-панели.</p>
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
