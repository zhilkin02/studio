'use server';
/**
 * @fileOverview A flow for generating keywords from video title and description.
 * - generateKeywords - A function that handles the keyword generation process.
 * - GenerateKeywordsInput - The input type for the generateKeywords function.
 * - GenerateKeywordsOutput - The return type for the generateKeywords function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateKeywordsInputSchema = z.object({
  title: z.string().describe('The title of the video.'),
  description: z.string().describe('The description of the video.'),
});
export type GenerateKeywordsInput = z.infer<typeof GenerateKeywordsInputSchema>;

const GenerateKeywordsOutputSchema = z.object({
  keywords: z
    .string()
    .describe(
      'A comma-separated list of relevant keywords based on the title and description.'
    ),
});
export type GenerateKeywordsOutput = z.infer<
  typeof GenerateKeywordsOutputSchema
>;

export async function generateKeywords(
  input: GenerateKeywordsInput
): Promise<GenerateKeywordsOutput> {
  return generateKeywordsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateKeywordsPrompt',
  input: { schema: GenerateKeywordsInputSchema },
  output: { schema: GenerateKeywordsOutputSchema },
  prompt: `You are an expert in SEO and video content analysis. Based on the following video title and description, generate a comma-separated list of 5 to 10 relevant and concise keywords in Russian. These keywords should help users find the video easily.

Title: {{{title}}}
Description: {{{description}}}

Generate only the keywords, separated by commas.`,
});

const generateKeywordsFlow = ai.defineFlow(
  {
    name: 'generateKeywordsFlow',
    inputSchema: GenerateKeywordsInputSchema,
    outputSchema: GenerateKeywordsOutputSchema,
  },
  async (input) => {
    // If both title and description are short, don't even bother calling the AI.
    if (input.title.length < 5 && input.description.length < 10) {
        return { keywords: '' };
    }
    const { output } = await prompt(input);
    return output!;
  }
);
