'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { approveVideo, rejectVideo } from './actions';

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

export function PendingVideos() {
  const firestore = useFirestore();

  const pendingVideosQuery = useMemo(() => {
    return query(collection(firestore, 'pendingVideoFragments'), orderBy('uploadDate', 'desc'));
  }, [firestore]);

  const { data: videos, isLoading, error } = useCollection<VideoFragment>(pendingVideosQuery);

  const handleApprove = (video: VideoFragment) => {
    // approveVideo(video);
    alert(`Одобрение для: ${video.title} (в разработке)`);
  };

  const handleReject = (video: VideoFragment) => {
    // rejectVideo(video);
    alert(`Отклонение для: ${video.title} (в разработке)`);
  };


  if (isLoading) {
    return <p>Загрузка ожидающих видео...</p>;
  }

  if (error) {
    return <p className="text-destructive">Ошибка загрузки видео: {error.message}</p>;
  }

  if (!videos || videos.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Нет видео, ожидающих модерации.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Ожидают модерации</h2>
      {videos.map((video) => (
        <Card key={video.id}>
          <CardHeader>
            <CardTitle className="flex justify-between items-start">
              {video.title}
              <Badge variant={video.status === 'pending' ? 'secondary' : 'default'}>
                {video.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{video.description}</p>
            <video controls src={video.filePath} className="w-full rounded-lg" preload="metadata"></video>
            <div className="text-sm text-muted-foreground">
              <p>Загрузчик: {video.uploaderId}</p>
              <p>Дата: {new Date(video.uploadDate.seconds * 1000).toLocaleString()}</p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => handleReject(video)}>Отклонить</Button>
            <Button onClick={() => handleApprove(video)}>Одобрить</Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
