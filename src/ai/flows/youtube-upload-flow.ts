'use server';
/**
 * @fileOverview A Genkit flow for uploading videos to a specific YouTube channel.
 *
 * - uploadVideoToYouTube - The exported function that triggers the flow.
 * - UploadVideoInput - The input type for the flow.
 * - UploadVideoOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { google } from 'googleapis';
import { Readable } from 'stream';

// ##################################################################################
// ВАЖНО: Вы должны настроить эти значения в вашей среде.
// 1. Перейдите в Google Cloud Console, в проекте 'konk-media-archive', включите "YouTube Data API v3". (Уже сделано)
// 2. Создайте учетные данные OAuth 2.0.
//    - Перейдите в "Credentials" -> "Create Credentials" -> "OAuth client ID".
//    - Выберите "Desktop app" в качестве типа приложения.
//    - После создания вы получите CLIENT_ID и CLIENT_SECRET.
// 3. Получите REFRESH_TOKEN для вашего канала. Это **одноразовая настройка**.
//    - Это самый сложный шаг. Вам нужно запустить скрипт, который попросит вас войти в свой аккаунт Google
//      и дать разрешение приложению на управление вашим YouTube-каналом.
//    - Простой способ сделать это - использовать `google-auth-cli` или написать небольшой Node.js скрипт.
//      (Инструкции можно найти в документации Google API).
// 4. Сохраните эти три значения в переменных окружения (например, в файле .env.local).
//    - YOUTUBE_CLIENT_ID=ВАШ_КЛИЕНТ_ID
//    - YOUTUBE_CLIENT_SECRET=ВАШ_КЛИЕНТ_SECRET
//    - YOUTUBE_REFRESH_TOKEN=ВАШ_REFRESH_TOKEN
// ##################################################################################
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || 'YOUR_CLIENT_ID';
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN || 'YOUR_REFRESH_TOKEN';


const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const youtube = google.youtube({
  version: 'v3',
  auth: oauth2Client,
});


export const UploadVideoInputSchema = z.object({
  title: z.string().describe('The title of the video.'),
  description: z.string().describe('The description of the video.'),
  videoDataUri: z.string().describe("The video file as a data URI (e.g., 'data:video/mp4;base64,...')."),
});
export type UploadVideoInput = z.infer<typeof UploadVideoInputSchema>;

export const UploadVideoOutputSchema = z.object({
  videoId: z.string().optional().describe('The ID of the uploaded YouTube video.'),
  error: z.string().optional().describe('An error message if the upload failed.'),
});
export type UploadVideoOutput = z.infer<typeof UploadVideoOutputSchema>;


export async function uploadVideoToYouTube(input: UploadVideoInput): Promise<UploadVideoOutput> {
  return uploadVideoFlow(input);
}


const uploadVideoFlow = ai.defineFlow(
  {
    name: 'uploadVideoFlow',
    inputSchema: UploadVideoInputSchema,
    outputSchema: UploadVideoOutputSchema,
  },
  async (input) => {
    
    // Проверка, что учетные данные YouTube были настроены.
    if (CLIENT_ID === 'YOUR_CLIENT_ID' || CLIENT_SECRET === 'YOUR_CLIENT_SECRET' || REFRESH_TOKEN === 'YOUR_REFRESH_TOKEN') {
        const errorMessage = 'YouTube API не настроен на сервере. Пожалуйста, следуйте инструкциям в файле src/ai/flows/youtube-upload-flow.ts для настройки учетных данных.';
        console.error(errorMessage);
        return { error: errorMessage };
    }

    try {
      // Преобразование data URI в Buffer, а затем в Readable Stream для API
      const buffer = Buffer.from(input.videoDataUri.split(',')[1], 'base64');
      const videoStream = new Readable();
      videoStream.push(buffer);
      videoStream.push(null);

      const response = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: input.title,
            description: input.description,
            tags: ['konk', 'media', 'fragment'],
            categoryId: '24', // Entertainment
          },
          status: {
            privacyStatus: 'unlisted', // 'private', 'public', или 'unlisted'. 'unlisted' лучше всего для модерации.
          },
        },
        media: {
          body: videoStream,
        },
      });

      const videoId = response.data.id;
      if (!videoId) {
        throw new Error('YouTube API did not return a video ID.');
      }

      console.log(`Successfully uploaded video to YouTube with ID: ${videoId}`);
      return { videoId: videoId };

    } catch (err: any) {
      console.error('Error uploading to YouTube:', err);
      
      // Попытка извлечь более понятное сообщение об ошибке из ответа API
      let errorMessage = 'An unknown error occurred during YouTube upload.';
      if (err.response?.data?.error?.message) {
        errorMessage = err.response.data.error.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      return { error: `Ошибка при загрузке на YouTube: ${errorMessage}` };
    }
  }
);
