import type { Integration } from "@/core/models/models";
import { syncFirecrawlCrawlStep } from "./sync-steps/sync-crawl-step";
import { parseFirecrawlStep } from "./sync-steps/parse-step";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { firecrawlConfig } from "./config";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { deleteAllFirecrawlData } from "./db/queries";
import type { SqliteDb } from "@/core/models/db-models";

export const syncFirecrawlPipeline = async (incremental: boolean = false, db: SqliteDb) => {
  await syncFirecrawlCrawlStep(incremental, db);
  await parseFirecrawlStep(db);
  await indexVectorDbStep("Firecrawl", incremental, db);
}

export const firecrawlIntegration: Integration = {
  config: firecrawlConfig,
  sync: async (db: SqliteDb) => await syncFirecrawlPipeline(false, db),
  syncUpdates: async (db: SqliteDb) => await syncFirecrawlPipeline(true, db),
  deleteSync: async (db: SqliteDb) => {
    await deleteSyncTasksByIntegration("Firecrawl", db);
    await deleteMdArtifactsByIntegration("Firecrawl", db);
    await deleteEmbeddingByIntegration("Firecrawl", db);
    await deleteAllFirecrawlData(db);
  }
}
