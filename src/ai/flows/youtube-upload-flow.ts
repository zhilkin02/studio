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

// IMPORTANT: You must configure these values in your environment.
// 1. Go to Google Cloud Console, enable the "YouTube Data API v3".
// 2. Create OAuth 2.0 credentials (for a TV or Limited Input device).
// 3. Follow the authentication flow to get a REFRESH_TOKEN for your channel.
//    - This is a one-time setup. You can use scripts like google-auth-cli to get it.
// 4. Store these values securely (e.g., in .env.local).
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
    
    // Placeholder for real credentials check
    if (CLIENT_ID === 'YOUR_CLIENT_ID' || CLIENT_SECRET === 'YOUR_CLIENT_SECRET' || REFRESH_TOKEN === 'YOUR_REFRESH_TOKEN') {
        console.error("YouTube API credentials are not configured.");
        return { error: 'YouTube API не настроен на сервере. Пожалуйста, обратитесь к администратору.' };
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
            privacyStatus: 'unlisted', // 'private', 'public', or 'unlisted'
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

      return { videoId: videoId };

    } catch (err: any) {
      console.error('Error uploading to YouTube:', err);
      // Try to provide a more user-friendly error message
      const errorMessage = err.response?.data?.error?.message || err.message || 'An unknown error occurred during YouTube upload.';
      return { error: `Ошибка при загрузке на YouTube: ${errorMessage}` };
    }
  }
);
