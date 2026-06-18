import type { Integration } from "@/core/models/models";
import { syncGongCallsStep } from "./sync-steps/sync-calls-step";
import { syncGongTranscriptsStep } from "./sync-steps/sync-transcripts-step";
import { parseGongStep } from "./sync-steps/parse-step";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { gongConfig } from "./config";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { deleteAllGongData } from "./db/queries";

export const syncGongPipeline = async (incremental: boolean = false) => {
  await Promise.all([
    syncGongCallsStep(incremental),
    syncGongTranscriptsStep(incremental)
  ]);
  await parseGongStep();
  await indexVectorDbStep("Gong")
}

export const gongIntegration: Integration = {
  config: gongConfig,
  sync: () => syncGongPipeline(false),
  syncUpdates: () => syncGongPipeline(true),
  deleteSync: async() => {
    await deleteSyncTasksByIntegration("Gong");
    await deleteMdArtifactsByIntegration("Gong");
    await deleteEmbeddingByIntegration("Gong");
    await deleteAllGongData();
  }
}
