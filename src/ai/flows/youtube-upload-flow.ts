'use server';
/**
 * @fileOverview A Genkit flow for uploading videos to a specific YouTube channel.
 *
 * - uploadVideoToYouTube - The exported function that triggers the flow.
 */

import { ai } from '@/ai/genkit';
import { UploadVideoInput, UploadVideoInputSchema, UploadVideoOutput, UploadVideoOutputSchema } from '@/ai/schemas/youtube-upload-schema';
import { Readable } from 'stream';

// ##################################################################################
// ВАЖНО: Эти значения были вставлены для отладки.
// Если ошибка сохраняется, проблема не в коде, а в самих учетных данных
// или настройках проекта Google Cloud.
// Убедитесь, что YouTube Data API v3 включен:
// https://console.cloud.google.com/apis/library/youtube.googleapis.com
// ##################################################################################
const CLIENT_ID = "715036389581-ok3ottibrbnjvfvut1ggegnsbpo30ijt.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN = "1//04A0nP3ylt28dCgYIARAAGAQSNwF-L9IrR5kFZ2rF1CFizsCcsrwLtyyRf-qaih3yRkVdsJl0zfwlM_EEU4MvjhajSZB5uygvXOI";


async function getAccessToken() {
  console.log("Попытка получить новый Access Token...");
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Ошибка при получении Access Token:", data);
    throw new Error(`Не удалось обновить токен: ${data.error_description || data.error}`);
  }
  
  console.log("Access Token успешно получен.");
  return data.access_token;
}


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
    
    console.log('--- YouTube Upload Flow (Manual Fetch) ---');
    console.log('Используемый CLIENT_ID:', CLIENT_ID ? `...${CLIENT_ID.slice(-4)}` : 'НЕ НАЙДЕН');
    console.log('---------------------------');

    try {
      const accessToken = await getAccessToken();

      const metadata = {
        snippet: {
          title: input.title,
          description: input.description,
          tags: ['konk', 'media', 'fragment'],
          categoryId: '24', // Entertainment
        },
        status: {
          privacyStatus: 'unlisted',
        },
      };

      const buffer = Buffer.from(input.videoDataUri.split(',')[1], 'base64');
      
      console.log('Начало загрузки видео на YouTube...');
      const uploadResponse = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'video/*',
        },
        body: JSON.stringify(metadata)
      });

      if (!uploadResponse.ok || !uploadResponse.headers.has('location')) {
         const errorData = await uploadResponse.json();
         console.error('Ошибка на первом этапе загрузки (создание metadata):', errorData);
         throw new Error(`API metadata error: ${errorData.error.message}`);
      }

      const locationUrl = uploadResponse.headers.get('location')!;
      console.log('Получен URL для загрузки:', locationUrl);

      console.log('Загрузка бинарных данных видео...');
      const uploadVideoResponse = await fetch(locationUrl, {
          method: 'POST',
          headers: {
              'Content-Type': 'video/*'
          },
          body: buffer
      });
      
      const responseData = await uploadVideoResponse.json();

      if (!uploadVideoResponse.ok) {
        console.error('Ошибка на втором этапе загрузки (передача видео):', responseData);
        throw new Error(`API upload error: ${responseData.error.message}`);
      }

      const videoId = responseData.id;
      if (!videoId) {
        throw new Error('YouTube API did not return a video ID.');
      }

      console.log(`Видео успешно загружено на YouTube с ID: ${videoId}`);
      return { videoId: videoId };

    } catch (err: any) {
      console.error('Подробная ошибка в потоке загрузки на YouTube:', err);
      return { error: `Ошибка при загрузке на YouTube: ${err.message}` };
    }
  }
);
