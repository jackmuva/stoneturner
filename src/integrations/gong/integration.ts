import type { Integration } from "@/core/models/models";
import { syncGongCallsStep } from "./sync-steps/sync-calls-step";
import { syncGongTranscriptsStep } from "./sync-steps/sync-transcripts-step";
import { parseGongStep } from "./sync-steps/parse-step";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { gongConfig } from "./config";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { db } from "@/core/db/db";
import { deleteAllGongData } from "./db/queries";

export const syncGongPipeline = async (incremental: boolean = false) => {
  await Promise.all([
    syncGongCallsStep(incremental),
    syncGongTranscriptsStep(incremental)
  ]);
  await parseGongStep();
  await indexVectorDbStep("Gong", incremental);
}

export const gongIntegration: Integration = {
  config: gongConfig,
  sync: async() => await syncGongPipeline(false),
  syncUpdates: async() => await syncGongPipeline(true),
  deleteSync: async() => {
    await deleteSyncTasksByIntegration("Gong", db);
    await deleteMdArtifactsByIntegration("Gong", db);
    await deleteEmbeddingByIntegration("Gong", db);
    await deleteAllGongData();
  }
}
