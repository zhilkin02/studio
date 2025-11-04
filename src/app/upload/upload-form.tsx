"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadVideo } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";

export function UploadForm() {
  const { toast } = useToast();
  const [state, formAction] = useActionState(uploadVideo, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      toast({
        title: "Успешно!",
        description: "Видео отправлено на модерацию.",
      });
      formRef.current?.reset();
    }
    if (state?.error) {
      toast({
        variant: "destructive",
        title: "Ошибка загрузки",
        description: state.error,
      });
    }
  }, [state, toast]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Название</Label>
        <Input
          id="title"
          name="title"
          required
          placeholder="Например: 'Где ДЕТОНАТОР?!'"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Описание / Ключевые слова</Label>
        <Textarea
          id="description"
          name="description"
          required
          placeholder="Темный рыцарь, Джокер, детонатор, больница..."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="video">Видеофайл (mp4, webm)</Label>
        <Input id="video" name="video" type="file" required accept="video/mp4,video/webm" />
      </div>
      <Button type="submit" className="w-full">
        <Upload className="mr-2" />
        Загрузить и отправить на модерацию
      </Button>
    </form>
  );
}
