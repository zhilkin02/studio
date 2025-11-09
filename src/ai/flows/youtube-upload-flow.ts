'use server';
/**
 * @fileOverview A Genkit flow for uploading videos to a specific YouTube channel.
 *
 * - uploadVideoToYouTube - The exported function that triggers the flow.
 */

import { ai } from '@/ai/genkit';
import { UploadVideoInput, UploadVideoInputSchema, UploadVideoOutput, UploadVideoOutputSchema } from '@/ai/schemas/youtube-upload-schema';
import { Readable } from 'stream';

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;


async function getAccessToken() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error("Отсутствуют учетные данные YouTube в переменных окружения.");
  }
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: "715036389581-ok3ottibrbnjvfvut1ggegnsbpo30ijt.apps.googleusercontent.com",
      client_secret: "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",
      refresh_token: "1//04A0nP3ylt28dCgYIARAAGAQSNwF-L9IrR5kFZ2rF1CFizsCcsrwLtyyRf-qaih3yRkVdsJl0zfwlM_EEU4MvjhajSZB5uygvXOI",
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Ошибка при получении Access Token:", data);
    throw new Error(`Не удалось обновить токен: ${data.error_description || data.error}`);
  }
  
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
      
      const uploadUrl = `https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable`;
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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

      return { videoId: videoId };

    } catch (err: any) {
      console.error('Подробная ошибка в потоке загрузки на YouTube:', err);
      // Simplify the error message to avoid redundant "Ошибка: Ошибка: ..."
      const originalMessage = err.message.includes('API') ? err.message.split('error: ')[1] : err.message;
      return { error: `Ошибка при загрузке на YouTube: ${originalMessage}` };
    }
  }
);
