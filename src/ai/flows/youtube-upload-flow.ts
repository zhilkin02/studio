'use server';
/**
 * @fileOverview A Genkit flow for uploading videos to a specific YouTube channel.
 *
 * - uploadVideoToYouTube - The exported function that triggers the flow.
 */

import { ai } from '@/ai/genkit';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { UploadVideoInput, UploadVideoInputSchema, UploadVideoOutput, UploadVideoOutputSchema } from '@/ai/schemas/youtube-upload-schema';


// ##################################################################################
// ВАЖНО: Вы должны настроить эти значения в вашей среде.
//
// 1. CLIENT_ID и CLIENT_SECRET:
//    - Перейдите в Google Cloud Console -> APIs & Services -> Credentials.
//    - Нажмите "Create Credentials" -> "OAuth client ID".
//    - **ВАЖНО**: Выберите тип приложения "Web application" (Веб-приложение).
//    - В разделе "Authorized redirect URIs" ("Разрешенные URI перенаправления") добавьте `https://developers.google.com/oauthplayground`.
//    - Создайте учетные данные и скопируйте Client ID и Client Secret сюда.
//
// 2. REFRESH_TOKEN: Это самый сложный шаг. Вам нужно получить этот токен для вашего канала.
//    Это **одноразовая настройка**.
//    - Перейдите на https://developers.google.com/oauthplayground
//    - В правом верхнем углу нажмите на шестеренку (Настройки).
//    - В открывшемся окне, **поставьте галочку напротив "Use your own OAuth credentials"**.
//      - В появившиеся поля "OAuth Client ID" и "OAuth Client secret" вставьте ваш Client ID и Client Secret, полученные на шаге 1. Закройте окно настроек.
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
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN || '1//04ch-5sfihAOGCgYIARAAGAQSNwF-L9Ir64R28WFyVO5pBASNhiU2ek3lSG5sdmJvSK-QQOyNiUdxfBJEsosZej1WhxEWeTj5FZE';


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
