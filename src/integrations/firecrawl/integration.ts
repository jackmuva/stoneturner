import type { Integration } from "@/core/models/models";
import { firecrawlConfig } from "./config";
import { deleteMdArtifactsByIntegration, deleteSourceContextByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { deleteAllFirecrawlData } from "./db/queries";
import type { SqliteDb } from "@/core/models/db-models";
import { firecrawlPipeline } from "./pipeline";

export const firecrawlIntegration: Integration = {
  config: firecrawlConfig,
  syncPipeline: firecrawlPipeline,
  deleteSync: async (db: SqliteDb) => {
    await deleteSyncTasksByIntegration("firecrawl", db);
    await deleteMdArtifactsByIntegration("firecrawl", db);
    await deleteEmbeddingByIntegration("firecrawl", db);
    await deleteSourceContextByIntegration("firecrawl", db);
    await deleteAllFirecrawlData(db);
  },
};
