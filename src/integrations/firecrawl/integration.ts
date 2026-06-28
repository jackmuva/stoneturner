import type { Integration } from "@/core/models/models";
import { syncFirecrawlCrawlStep } from "./sync-steps/sync-crawl-step";
import { parseFirecrawlStep } from "./sync-steps/parse-step";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { firecrawlConfig } from "./config";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { deleteAllFirecrawlData } from "./db/queries";

export const syncFirecrawlPipeline = async (incremental: boolean = false) => {
  await syncFirecrawlCrawlStep(incremental);
  await parseFirecrawlStep();
  await indexVectorDbStep("Firecrawl", incremental);
}

export const firecrawlIntegration: Integration = {
  config: firecrawlConfig,
  sync: async () => await syncFirecrawlPipeline(false),
  syncUpdates: async () => await syncFirecrawlPipeline(true),
  deleteSync: async () => {
    await deleteSyncTasksByIntegration("Firecrawl");
    await deleteMdArtifactsByIntegration("Firecrawl");
    await deleteEmbeddingByIntegration("Firecrawl");
    await deleteAllFirecrawlData();
  }
}
