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
// ВАЖНО: Вы должны настроить эти значения.
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
//      - Вы увидите "Refresh token". Скопируйте его и вставьте сюда.
//
// 3. Убедитесь, что вы ОТОЗВАЛИ доступ старому приложению в настройках аккаунта Google: https://myaccount.google.com/permissions
// ##################################################################################
const CLIENT_ID = "715036389581-ok3ottibrbnjvfvut1ggegnsbpo30ijt.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN = "1//04A0nP3ylt28dCgYIARAAGAQSNwF-L9IrR5kFZ2rF1CFizsCcsrwLtyyRf-qaih3yRkVdsJl0zfwlM_EEU4MvjhajSZB5uygvXOI";


const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
);
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
    
    console.log('--- YouTube Upload Flow ---');
    console.log('Используемый CLIENT_ID:', CLIENT_ID ? `...${CLIENT_ID.slice(-4)}` : 'НЕ НАЙДЕН');
    console.log('Используемый REFRESH_TOKEN:', REFRESH_TOKEN ? `...${REFRESH_TOKEN.slice(-4)}` : 'НЕ НАЙДЕН');
    console.log('---------------------------');

    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
        const errorMessage = 'Учетные данные YouTube не настроены в коде. Пожалуйста, следуйте инструкциям в файле src/ai/flows/youtube-upload-flow.ts.';
        console.error(errorMessage);
        return { error: errorMessage };
    }

    try {
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
            privacyStatus: 'unlisted', 
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
      console.error('Подробная ошибка при загрузке на YouTube:', JSON.stringify(err, null, 2));
      
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
