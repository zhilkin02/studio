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
  phrase: z.string().describe('The main phrase or quote from the video fragment.'),
  sourceName: z.string().optional().describe('The name of the movie or series.'),
});
export type GenerateKeywordsInput = z.infer<typeof GenerateKeywordsInputSchema>;

const GenerateKeywordsOutputSchema = z.object({
  keywords: z.string().describe('A comma-separated string of relevant keywords.'),
});
export type GenerateKeywordsOutput = z
  .infer<typeof GenerateKeywordsOutputSchema>;


export async function generateKeywords(input: GenerateKeywordsInput): Promise<GenerateKeywordsOutput> {
    return generateKeywordsFlow(input);
}


const prompt = ai.definePrompt({
    name: 'generateKeywordsPrompt',
    input: { schema: GenerateKeywordsInputSchema },
    output: { schema: GenerateKeywordsOutputSchema },
    prompt: `You are an expert in video content tagging. Your task is to generate relevant keywords based on a phrase from a movie or TV series.

    **Instructions:**
    1.  The keywords MUST be in Russian.
    2.  The output should be a single comma-separated string.
    3.  Include each word from the original phrase.
    4.  Come up with 5-7 variations or synonyms for the key idea of the phrase. Think about how people might search for this phrase.
    5.  If a source (movie/series name) is provided, include it as a keyword.

    **Example:**
    *   **Input Phrase:** "Я вернусь."
    *   **Output Keywords:** "Я, вернусь, Я обязательно вернусь, Я ещё появлюсь, Ещё увидимся, Мы ещё встретимся, Я снова приду, Это ещё не конец"

    **User Input:**
    *   **Phrase:** {{{phrase}}}
    *   **Source Name:** {{{sourceName}}}
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
