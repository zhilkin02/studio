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
      
      console.log('Начало загрузки видео на YouTube (этап 1: создание сессии)...');
      
      // ИЗМЕНЕНИЕ: Убираем токен из заголовка и добавляем в URL
      const uploadUrl = `https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable&access_token=${accessToken}`;
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          // 'Authorization': `Bearer ${accessToken}`, // УДАЛЕНО
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'video/*',
        },
        body: JSON.stringify(metadata)
      });

      if (!uploadResponse.ok || !uploadResponse.headers.has('location')) {
         const errorText = await uploadResponse.text();
         let errorMessage;
         try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error.message;
         } catch(e) {
            errorMessage = errorText;
         }
         console.error('Ошибка на первом этапе загрузки (создание metadata):', errorMessage);
         throw new Error(`API metadata error: ${errorMessage}`);
      }

      const locationUrl = uploadResponse.headers.get('location')!;
      console.log('Получен URL для загрузки:', locationUrl);

      console.log('Загрузка бинарных данных видео (этап 2)...');
      const uploadVideoResponse = await fetch(locationUrl, {
          method: 'PUT',
          headers: {
              'Content-Type': 'video/*'
          },
          body: buffer
      });
      
      if (!uploadVideoResponse.ok) {
        const errorText = await uploadVideoResponse.text();
        let errorData;
        try {
           errorData = JSON.parse(errorText);
        } catch(e) {
            errorData = {error: {message: errorText}};
        }
        console.error('Ошибка на втором этапе загрузки (передача видео):', errorData);
        throw new Error(`API upload error: ${errorData.error.message}`);
      }
      
      const responseData = await uploadVideoResponse.json();

      const videoId = responseData.id;
      if (!videoId) {
        console.error("YouTube API не вернул videoId в ответе:", responseData);
        throw new Error('YouTube API did not return a video ID.');
      }

      console.log(`Видео успешно загружено на YouTube с ID: ${videoId}`);
      return { videoId: videoId };

    } catch (err: any) {
      console.error('Подробная ошибка в потоке загрузки на YouTube:', err);
      // Возвращаем исходное сообщение об ошибке, чтобы было понятнее
      const originalMessage = err.message.startsWith('API') ? err.message.split(': ')[1] : err.message;
      return { error: `Ошибка при загрузке на YouTube: ${originalMessage}` };
    }
  }
);
