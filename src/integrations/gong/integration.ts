import type { Integration } from "@/core/models/models";
import { syncGongCallsStep } from "./sync-steps/sync-calls-step";
import { syncGongTranscriptsStep } from "./sync-steps/sync-transcripts-step";
import { parseGongStep } from "./sync-steps/parse-step";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { gongConfig } from "./config";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { deleteAllGongData } from "./db/queries";
import type { SqliteDb } from "@/core/models/db-models";

export const syncGongPipeline = async (incremental: boolean = false, db: SqliteDb) => {
  await Promise.all([
    syncGongCallsStep(incremental, db),
    syncGongTranscriptsStep(incremental, db)
  ]);
  await parseGongStep(db);
  await indexVectorDbStep("Gong", incremental, db);
}

export const gongIntegration: Integration = {
  config: gongConfig,
  sync: async(db: SqliteDb) => await syncGongPipeline(false, db),
  syncUpdates: async(db: SqliteDb) => await syncGongPipeline(true, db),
  deleteSync: async(db: SqliteDb) => {
    await deleteSyncTasksByIntegration("Gong", db);
    await deleteMdArtifactsByIntegration("Gong", db);
    await deleteEmbeddingByIntegration("Gong", db);
    await deleteAllGongData(db);
  }
}
