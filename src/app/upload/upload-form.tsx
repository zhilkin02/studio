'use client';

import { useState, useRef } from 'react';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Upload } from 'lucide-react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

export function UploadForm() {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const { user } = useUser();
  const firestore = useFirestore();
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Вы должны войти в систему, чтобы загружать видео.',
      });
      return;
    }

    const formData = new FormData(event.currentTarget);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const videoFile = formData.get('video') as File;

    if (!title || !description || !videoFile || videoFile.size === 0) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Пожалуйста, заполните все поля и выберите файл.',
      });
      return;
    }

    setIsUploading(true);

    try {
      const storage = getStorage();
      const videoId = uuidv4();
      const fileExtension = videoFile.name.split('.').pop();
      const filePath = `pending/${videoId}.${fileExtension}`;
      const storageRef = ref(storage, filePath);

      // 1. Upload video to Firebase Storage
      const uploadTask = await uploadBytes(storageRef, videoFile);
      const downloadURL = await getDownloadURL(uploadTask.ref);

      // 2. Create document in Firestore
      await addDoc(collection(firestore, 'pendingVideoFragments'), {
        title,
        description,
        filePath: downloadURL,
        uploaderId: user.uid,
        uploadDate: serverTimestamp(),
        status: 'pending',
      });

      toast({
        title: 'Успешно!',
        description:
          'Ваше видео загружено и отправлено на модерацию.',
      });
      formRef.current?.reset();
    } catch (error: any) {
      console.error('Error uploading video:', error);
      toast({
        variant: 'destructive',
        title: 'Ошибка загрузки',
        description:
          error.message || 'Произошла неизвестная ошибка.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Название</Label>
        <Input
          id="title"
          name="title"
          required
          placeholder="Например: 'Где ДЕТОНАТОР?!'"
          disabled={isUploading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Описание / Ключевые слова</Label>
        <Textarea
          id="description"
          name="description"
          required
          placeholder="Темный рыцарь, Джокер, детонатор, больница..."
          disabled={isUploading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="video">Видеофайл (mp4, webm)</Label>
        <Input
          id="video"
          name="video"
          type="file"
          required
          accept="video/mp4,video/webm"
          disabled={isUploading}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isUploading}>
        {isUploading ? (
          'Загрузка...'
        ) : (
          <>
            <Upload className="mr-2" />
            Загрузить и отправить
          </>
        )}
      </Button>
    </form>
  );
}
