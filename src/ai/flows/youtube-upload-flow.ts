'use server';
/**
 * @fileOverview A flow for uploading a video to YouTube.
 * - uploadVideoToYouTube - A function that handles the video upload process.
 * - YouTubeUploadInput - The input type for the uploadVideoToYouTube function.
 * - YouTubeUploadOutput - The return type for the uploadVideoToYouTube function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Buffer } from 'buffer';

const YouTubeUploadInputSchema = z.object({
    title: z.string().describe('The title of the video.'),
    description: z.string().describe('The description of the video.'),
    videoDataUri: z.string().describe("The video file as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type YouTubeUploadInput = z.infer<typeof YouTubeUploadInputSchema>;

const YouTubeUploadOutputSchema = z.object({
    videoId: z.string().optional().describe('The ID of the uploaded video.'),
    error: z.string().optional().describe('An error message if the upload failed.'),
    quotaExceeded: z.boolean().optional().describe('Indicates if the YouTube quota was exceeded.'),
});
export type YouTubeUploadOutput = z.infer<typeof YouTubeUploadOutputSchema>;

export async function uploadVideoToYouTube(input: YouTubeUploadInput): Promise<YouTubeUploadOutput> {
    return uploadVideoFlow(input);
}

const uploadVideoFlow = ai.defineFlow(
    {
        name: 'uploadVideoFlow',
        inputSchema: YouTubeUploadInputSchema,
        outputSchema: YouTubeUploadOutputSchema,
    },
    async (input) => {
        const { title, description, videoDataUri } = input;
        
        const clientId = process.env.YOUTUBE_CLIENT_ID;
        const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
        const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
        const apiKey = process.env.YOUTUBE_API_KEY;
        
        if (!clientId || !clientSecret || !refreshToken || !apiKey) {
             return { error: 'Отсутствуют учетные данные YouTube в файле .env.local' };
        }

        try {
            // Step 1: Get a new access token from the refresh token
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    client_id: clientId,
                    client_secret: clientSecret,
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token',
                }),
            });

            const tokenData = await tokenResponse.json();
            if (!tokenData.access_token) {
                return { error: `Не удалось обновить токен: ${JSON.stringify(tokenData)}` };
            }
            const accessToken = tokenData.access_token;

            // Step 2: Create a resumable upload session
            const videoMetadata = {
                snippet: {
                    title: title,
                    description: description,
                    tags: ['konk', 'video archive'],
                    categoryId: '22', // People & Blogs
                },
                status: {
                    privacyStatus: 'unlisted', // 'private', 'public' or 'unlisted'
                },
            };
            
            const createSessionUrl = `https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&key=${apiKey}&uploadType=resumable`;

            const sessionResponse = await fetch(createSessionUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json; charset=UTF-8',
                    'X-Upload-Content-Length': Buffer.from(videoDataUri.split(',')[1], 'base64').length.toString(),
                    'X-Upload-Content-Type': videoDataUri.substring(videoDataUri.indexOf(':') + 1, videoDataUri.indexOf(';')),
                },
                body: JSON.stringify(videoMetadata),
            });
            
            if (!sessionResponse.ok) {
                 const errorText = await sessionResponse.text();
                 if (errorText.includes('uploadLimitExceeded') || errorText.includes('exceeded the number of videos')) {
                    return { error: "Суточный лимит загрузки видео на YouTube исчерпан.", quotaExceeded: true };
                 }
                 if (errorText.includes('invalid_client')) {
                    return { error: "Ошибка аутентификации YouTube: неверный клиент. Проверьте учетные данные в .env.local." };
                 }
                 return { error: `Ошибка создания сессии загрузки: ${sessionResponse.status} ${sessionResponse.statusText}. ${errorText}` };
            }

            const uploadUrl = sessionResponse.headers.get('Location');
            if (!uploadUrl) {
                return { error: 'Не удалось получить URL для загрузки от YouTube.' };
            }

            // Step 3: Upload the video file
            const videoBuffer = Buffer.from(videoDataUri.split(',')[1], 'base64');
            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Length': videoBuffer.length.toString(),
                },
                body: videoBuffer,
            });

            if (!uploadResponse.ok) {
                 const errorText = await uploadResponse.text();
                return { error: `Ошибка при загрузке файла: ${uploadResponse.status} ${uploadResponse.statusText}. ${errorText}` };
            }

            const uploadResult = await uploadResponse.json();

            return { videoId: uploadResult.id };

        } catch (e: any) {
            console.error("Error in YouTube upload flow:", e);
            return { error: e.message || 'Произошла неизвестная ошибка в процессе загрузки.' };
        }
    }
);
