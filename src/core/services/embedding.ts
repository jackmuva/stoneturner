import { ChromaValueError, type ChromaClient, type EmbeddingFunction } from "chromadb";
import { embedMany } from 'ai';

export interface MyEmbeddingConfig {
  model: string;
}

export class VercelEmbeddingFunction implements EmbeddingFunction {
  public readonly name = "vercel-embed";
  private readonly model: string;

  constructor(args: { model: string }) {
    this.model = args.model;
  }

  async generate(texts: string[]): Promise<number[][]> {
    const results = await embedMany({
      model: 'openai/text-embedding-3-small',
      values: texts,
    })
    return results.embeddings;
  }

  getConfig(): MyEmbeddingConfig {
    return {
      model: this.model,
    };
  }

  validateConfigUpdate(config: Record<string, any>) {
    if ("model" in config) {
      throw new ChromaValueError("Model cannot be updated");
    }
  }

  static buildFromConfig(
    config: MyEmbeddingConfig,
    _client?: ChromaClient,
  ): VercelEmbeddingFunction {
    return new VercelEmbeddingFunction(config);
  }
}
