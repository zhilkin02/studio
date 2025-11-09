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
        
        const clientId = process.env.YOUTUBE_CLIENT_ID || "YOUR_YOUTUBE_CLIENT_ID";
        const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || "YOUR_YOUTUBE_CLIENT_SECRET";
        const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN || "YOUR_YOUTUBE_REFRESH_TOKEN";
        const apiKey = process.env.YOUTUBE_API_KEY || "YOUR_YOUTUBE_API_KEY";

        if (!clientId || !clientSecret || !refreshToken || !apiKey || clientId === "YOUR_YOUTUBE_CLIENT_ID") {
            return { success: false, error: 'Отсутствуют или не заменены учетные данные YouTube.' };
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
                return { success: false, error: `Не удалось обновить токен: ${JSON.stringify(tokenData)}` };
            }
            const accessToken = tokenData.access_token;
            
            // Step 2: Call the videos.delete endpoint
            const deleteUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}`;
            
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
                 let errorMessage = `Ошибка при удалении видео: ${deleteResponse.status} ${deleteResponse.statusText}. ${errorText}`;
                 if (errorText.includes('uploadLimitExceeded') || errorText.includes('exceeded the number of videos')) {
                    errorMessage = "Суточный лимит на действия с видео на YouTube исчерпан. Пожалуйста, попробуйте снова завтра.";
                 }
                 if (errorText.includes('invalid_client')) {
                    errorMessage = "Ошибка аутентификации YouTube: неверный клиент. Проверьте учетные данные.";
                 }
                 return { success: false, error: errorMessage };
            }

        } catch (e: any) {
            console.error("Error in YouTube delete flow:", e);
            return { success: false, error: e.message || 'Произошла неизвестная ошибка в процессе удаления.' };
        }
    }
);
