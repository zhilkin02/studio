'use server';
/**
 * @fileOverview A flow for deleting a video from YouTube.
 * - deleteVideoFromYouTube - A function that handles the video deletion process.
 * - YouTubeDeleteInput - The input type for the deleteVideoFromYouTube function.
 * - YouTubeDeleteOutput - The return type for the deleteVideoFromYouTube function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const YouTubeDeleteInputSchema = z.object({
    videoId: z.string().describe('The ID of the video to delete.'),
});
export type YouTubeDeleteInput = z.infer<typeof YouTubeDeleteInputSchema>;

const YouTubeDeleteOutputSchema = z.object({
    success: z.boolean(),
    error: z.string().optional().describe('An error message if the deletion failed.'),
});
export type YouTubeDeleteOutput = z.infer<typeof YouTubeDeleteOutputSchema>;

export async function deleteVideoFromYouTube(input: YouTubeDeleteInput): Promise<YouTubeDeleteOutput> {
    return deleteVideoFlow(input);
}

const deleteVideoFlow = ai.defineFlow(
    {
        name: 'deleteVideoFlow',
        inputSchema: YouTubeDeleteInputSchema,
        outputSchema: YouTubeDeleteOutputSchema,
    },
    async (input) => {
        const { videoId } = input;

        const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
        const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
        const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;
        const API_KEY = process.env.YOUTUBE_API_KEY;

        if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !API_KEY) {
            return { success: false, error: 'Отсутствуют учетные данные YouTube в переменных окружения.' };
        }

        try {
            // Step 1: Get a new access token from the refresh token
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
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

            const tokenData = await tokenResponse.json();
            if (!tokenData.access_token) {
                return { success: false, error: `Не удалось обновить токен: ${JSON.stringify(tokenData)}` };
            }
            const accessToken = tokenData.access_token;
            
            // Step 2: Call the videos.delete endpoint
            const deleteUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${API_KEY}`;
            
            const deleteResponse = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (deleteResponse.status === 204) { // 204 No Content is a success for DELETE
                return { success: true };
            } else {
                 const errorText = await deleteResponse.text();
                 return { success: false, error: `Ошибка при удалении видео: ${deleteResponse.status} ${deleteResponse.statusText}. ${errorText}` };
            }

        } catch (e: any) {
            console.error("Error in YouTube delete flow:", e);
            return { success: false, error: e.message || 'Произошла неизвестная ошибка в процессе удаления.' };
        }
    }
);
