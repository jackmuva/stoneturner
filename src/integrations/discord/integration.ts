import type { Integration } from "@/core/models/models";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { discordConfig } from "./config";

export const syncGongPipeline = async (incremental: boolean = false) => {
    await indexVectorDbStep("discord", incremental);
}

export const discordIntegration: Integration = {
  config: discordConfig,
  sync: async() => await syncGongPipeline(false),
  syncUpdates: async() => await syncGongPipeline(true),
  deleteSync: async() => {
    await deleteSyncTasksByIntegration("discord");
    await deleteMdArtifactsByIntegration("discord");
    await deleteEmbeddingByIntegration("discord");
  }
}
