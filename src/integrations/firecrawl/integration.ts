import type { Integration } from "@/core/models/models";
import { syncFirecrawlCrawlStep } from "./sync-steps/sync-crawl-step";
import { parseFirecrawlStep } from "./sync-steps/parse-step";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { agentExploreContextStep } from "@/core/services/agent-explore-context-step";
import { firecrawlConfig } from "./config";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { deleteAllFirecrawlData } from "./db/queries";
import type { SqliteDb } from "@/core/models/db-models";

export const syncFirecrawlPipeline = async (incremental: boolean = false, db: SqliteDb) => {
  await syncFirecrawlCrawlStep(incremental, db);
  await parseFirecrawlStep(incremental, db);
  await indexVectorDbStep(incremental, db, { integration: "firecrawl" });
  await agentExploreContextStep(incremental, db, { integration: "firecrawl" });
}

export const firecrawlIntegration: Integration = {
  config: firecrawlConfig,
  sync: async (db: SqliteDb) => await syncFirecrawlPipeline(false, db),
  syncUpdates: async (db: SqliteDb) => await syncFirecrawlPipeline(true, db),
  deleteSync: async (db: SqliteDb) => {
    await deleteSyncTasksByIntegration("firecrawl", db);
    await deleteMdArtifactsByIntegration("firecrawl", db);
    await deleteEmbeddingByIntegration("firecrawl", db);
    await deleteAllFirecrawlData(db);
  }
}
