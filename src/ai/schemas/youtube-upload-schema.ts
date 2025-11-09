/**
 * @fileOverview Schemas and types for the YouTube video upload flow.
 * This file is separate to avoid Next.js "use server" conflicts.
 */

import { z } from 'genkit';

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
