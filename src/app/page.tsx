// This is now a Server Component
import { initializeServerApp } from '@/firebase/server';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getFirestore, collection, query, orderBy, getDocs, Timestamp } from 'firebase-admin/firestore';

// Define the type for our video data on the server
interface VideoFragmentServer {
  id: string;
  title: string;
  description: string;
  filePath: string;
  uploaderId: string;
  uploadDate: Timestamp; // Firestore Admin SDK uses its own Timestamp
  status: string;
}

// Define the type for the props passed to the client component (serializable)
interface VideoFragmentClient {
    id: string;
    title: string;
    description: string;
    filePath: string;
}


// Server-side function to fetch videos.
async function getPublicVideos(): Promise<VideoFragmentClient[]> {
  try {
    const { firestore } = initializeServerApp();
    const videosQuery = query(
      collection(firestore, "publicVideoFragments"), 
      orderBy("uploadDate", "desc")
    );
    const querySnapshot = await getDocs(videosQuery);

    // This is the correct way to handle an empty collection. It's not an error.
    if (querySnapshot.empty) {
      return [];
    }

    // Map server data to a serializable format for the client
    const videos = querySnapshot.docs.map(doc => {
        const data = doc.data() as VideoFragmentServer;
        return {
          id: doc.id,
          title: data.title,
          description: data.description,
          filePath: data.filePath,
        };
    });
    return videos;
  } catch (error) {
    console.error("Error fetching public videos:", error);
    // In case of a real error on the server, we return an empty array
    // to prevent the page from crashing.
    return [];
  }
}

// A simple Client Component to display the videos
function ApprovedVideos({ videos }: { videos: VideoFragmentClient[] }) {
  'use client';

  if (!videos || videos.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-lg bg-muted/50">
        <h3 className="text-xl font-semibold text-foreground">Видео пока нет</h3>
        <p className="text-muted-foreground mt-2">
          Загрузите видео и одобрите его в админ-панели, чтобы оно появилось здесь.
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

// The main page component is now an async Server Component
export default async function Home() {
  const videos = await getPublicVideos();

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
        <ApprovedVideos videos={videos} />
      </section>
    </div>
  );
}
