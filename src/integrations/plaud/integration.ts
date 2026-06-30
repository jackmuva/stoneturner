import type { Integration } from "@/core/models/models";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { plaudConfig } from "./config";
import { deletePlaudData } from "./db/queries";
import { syncPlaudFilesStep } from "./sync-steps/sync-files-step";
import { syncPlaudTranscriptsStep } from "./sync-steps/sync-transcripts-step";
import { parsePlaudStep } from "./sync-steps/parse-step";
import { handleOauthRedirect, handlePlaudRefresh } from "./sync-steps/plaud-utils";
import type { SqliteDb } from "@/core/models/db-models";

export const syncPlaudPipeline = async (incremental: boolean = false, db: SqliteDb) => {
  await syncPlaudFilesStep(incremental, db);   
  await syncPlaudTranscriptsStep(db);
  await parsePlaudStep(db);
  await indexVectorDbStep("Plaud", incremental, db);
}

export const plaudIntegration: Integration = {
  config: plaudConfig,
  sync: async (db: SqliteDb) => await syncPlaudPipeline(false, db),
  syncUpdates: async (db: SqliteDb) => await syncPlaudPipeline(true, db),
  deleteSync: async (db: SqliteDb) => {
    await deletePlaudData(db);
    await deleteSyncTasksByIntegration("Plaud", db);
    await deleteMdArtifactsByIntegration("Plaud", db);
    await deleteEmbeddingByIntegration("Plaud", db);
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: handlePlaudRefresh,
}
