'use client';

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { publicVideos } from '@/lib/static-data';

interface VideoFragment {
    id: string;
    title: string;
    description: string;
    filePath: string;
}

function ApprovedVideos({ videos }: { videos: VideoFragment[] }) {
  if (!videos || videos.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-lg bg-muted/50">
        <h3 className="text-xl font-semibold text-foreground">Видео пока нет</h3>
        <p className="text-muted-foreground mt-2">
          В данный момент нет доступных видео.
        </p>
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
        <ApprovedVideos videos={publicVideos} />
      </section>
    </div>
  );
}
