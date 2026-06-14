import { embedMany } from 'ai';

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const results = await embedMany({
    model: 'openai/text-embedding-3-small',
    values: texts,
  })
  return results.embeddings;
}
