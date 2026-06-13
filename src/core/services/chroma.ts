import { CloudClient, type Collection, type Metadata, type QueryResult, type Where } from "chromadb";
import { VercelEmbeddingFunction } from "./embedding";
import type { VectorDbMetadata } from "@/core/models/models";

const embedder = new VercelEmbeddingFunction({ model: "vercel-embedding" });

export interface ChromaDoc {
  ids: string[];
  documents: string[];
  metadatas: Metadata[];
}

export const chromaClient = new CloudClient();

let collection: Collection | null = null;
let qaCollection: Collection | null = null;
let kpCollection: Collection | null = null;

export const getChromaCollection = async () => {
  if (!collection) {
    collection = await chromaClient.getOrCreateCollection({
      name: "stoneturner-core",
      embeddingFunction: embedder,
      metadata: {
        description: "stoneturner vector db",
        created: new Date().toString(),
      },
    });
  }
  return collection;
};

export const getQuestionsAnsweredCollection = async () => {
  if (!qaCollection) {
    qaCollection = await chromaClient.getOrCreateCollection({
      name: "stoneturner-core-qa",
      embeddingFunction: embedder,
      metadata: {
        description: "Stoneturner Questions Answered",
        created: new Date().toString(),
      },
    });
  }
  return qaCollection;
};

export const getKeyPointsCollection = async () => {
  if (!kpCollection) {
    kpCollection = await chromaClient.getOrCreateCollection({
      name: "stoneturner-core-kp",
      embeddingFunction: embedder,
      metadata: {
        description: "Stoneturner Key Points",
        created: new Date().toString(),
      },
    });
  }
  return kpCollection;
};

export const queryVectorRecords = async (
  collection: Collection,
  queryEmbeddings: number[][],
  state: {
    userId: string,
    filter: {
      startDate?: string,
      endDate?: string,
      keywords?: string[],
      sources?: string[],
    }
  },
  limit: number,
): Promise<QueryResult<VectorDbMetadata>> => {
  const whereArray: Where[] = [];
  whereArray.push({ userId: { $eq: state.userId } })

  if (state.filter.sources?.length) {
    whereArray.push({ integration: { $in: state.filter.sources } });
  }
  if (state.filter.startDate) {
    whereArray.push({ artifactDate: { $gte: new Date(state.filter.startDate).getTime() } });
  }
  if (state.filter.endDate) {
    whereArray.push({ artifactDate: { $lte: new Date(state.filter.endDate).getTime() } });
  }

  const queryArgs: Record<string, unknown> = {
    queryEmbeddings,
    nResults: limit,
    where: { $and: whereArray },
  };

  if (state.filter.keywords?.length) {
    queryArgs.whereDocument = {
      $or: state.filter.keywords.map((keyword) => ({ $contains: keyword })),
    };
  }

  return await collection.query<VectorDbMetadata>(queryArgs);
}
