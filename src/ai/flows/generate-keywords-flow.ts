'use server';
/**
 * @fileOverview A flow for generating keywords for a video.
 * - generateKeywords - A function that handles keyword generation.
 * - GenerateKeywordsInput - The input type for the generateKeywords function.
 * - GenerateKeywordsOutput - The return type for the generateKeywords function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateKeywordsInputSchema = z.object({
  title: z.string().describe('The title of the video.'),
  description: z.string().optional().describe('The description of the video.'),
});
export type GenerateKeywordsInput = z.infer<typeof GenerateKeywordsInputSchema>;

const GenerateKeywordsOutputSchema = z.object({
  keywords: z.string().describe('A comma-separated string of relevant keywords.'),
});
export type GenerateKeywordsOutput = z.infer<typeof GenerateKeywordsOutputSchema>;


export async function generateKeywords(input: GenerateKeywordsInput): Promise<GenerateKeywordsOutput> {
    return generateKeywordsFlow(input);
}


const prompt = ai.definePrompt({
    name: 'generateKeywordsPrompt',
    input: { schema: GenerateKeywordsInputSchema },
    output: { schema: GenerateKeywordsOutputSchema },
    prompt: `You are an expert in video content tagging. Based on the provided title and description, generate a concise, comma-separated list of the most relevant keywords. 
    
    The keywords should be in Russian.
    Do not include more than 7 keywords.
    The keywords should be short and relevant.
    Focus on the main subjects, themes, and any notable names or concepts.
    Return only the comma-separated string of keywords.

    Title: {{{title}}}
    Description: {{{description}}}
    `,
});

const generateKeywordsFlow = ai.defineFlow(
  {
    name: 'generateKeywordsFlow',
    inputSchema: GenerateKeywordsInputSchema,
    outputSchema: GenerateKeywordsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      return { keywords: '' };
    }
    return output;
  }
);
