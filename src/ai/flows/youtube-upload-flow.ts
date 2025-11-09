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
//
// 1. CLIENT_ID и CLIENT_SECRET:
//    - Перейдите в Google Cloud Console -> APIs & Services -> Credentials.
//    - Нажмите "Create Credentials" -> "OAuth client ID".
//    - **ВАЖНО**: Выберите тип приложения "Web application" (Веб-приложение).
//    - В разделе "Authorized redirect URIs" добавьте `https://developers.google.com/oauthplayground`.
//    - Создайте учетные данные и скопируйте Client ID и Client Secret сюда.
//
// 2. REFRESH_TOKEN: Это самый сложный шаг. Вам нужно получить этот токен для вашего канала.
//    Это **одноразовая настройка**.
//    - Перейдите на https://developers.google.com/oauthplayground
//    - В правом верхнем углу нажмите на шестеренку (Настройки).
//    - В открывшемся окне, **поставьте галочку напротив "Use your own OAuth credentials"**.
//      - В появившиеся поля вставьте ваш Client ID и Client Secret, полученные на шаге 1. Закройте окно настроек.
//    - Слева, в шаге 1 "Select & authorize APIs", найдите "YouTube Data API v3" и выберите
//      `https://www.googleapis.com/auth/youtube.upload`.
//    - Нажмите "Authorize APIs". Войдите в свой аккаунт Google и дайте разрешение.
//    - В шаге 2 "Exchange authorization code for tokens", нажмите "Exchange authorization code for tokens".
//      - Вы увидите "Refresh token". Скопируйте его и вставьте ниже.
//
// 3. Сохраните REFRESH_TOKEN ниже.
// ##################################################################################
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || '715036389581-lajmllm6hst2m78c9o3hv5vn092ue6af.apps.googleusercontent.com';
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || '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';
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN || 'YOUR_REFRESH_TOKEN'; // <-- ВСТАВЬТЕ ВАШ REFRESH TOKEN СЮДА


const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
);
// Установите URI перенаправления, который вы добавили в консоли Google Cloud
oauth2Client.redirect_uri = 'https://developers.google.com/oauthplayground';
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
    if (CLIENT_ID.startsWith('YOUR_') || CLIENT_SECRET.startsWith('YOUR_') || REFRESH_TOKEN.startsWith('YOUR_')) {
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
