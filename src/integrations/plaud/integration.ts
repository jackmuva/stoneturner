import type { Integration } from "@/core/models/models";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { db } from "@/core/db/db";
import { plaudConfig } from "./config";
import { deletePlaudData } from "./db/queries";
import { syncPlaudFilesStep } from "./sync-steps/sync-files-step";
import { syncPlaudTranscriptsStep } from "./sync-steps/sync-transcripts-step";
import { parsePlaudStep } from "./sync-steps/parse-step";
import { handleOauthRedirect, handlePlaudRefresh } from "./sync-steps/plaud-utils";

export const syncPlaudPipeline = async (incremental: boolean = false) => {
  await syncPlaudFilesStep(incremental);   // must run first — detail fetch needs file ids
  await syncPlaudTranscriptsStep();
  await parsePlaudStep();
  await indexVectorDbStep("Plaud", incremental);
}

export const plaudIntegration: Integration = {
  config: plaudConfig,
  sync: async () => await syncPlaudPipeline(false),
  syncUpdates: async () => await syncPlaudPipeline(true),
  deleteSync: async () => {
    await deletePlaudData();
    await deleteSyncTasksByIntegration("Plaud", db);
    await deleteMdArtifactsByIntegration("Plaud", db);
    await deleteEmbeddingByIntegration("Plaud", db);
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: handlePlaudRefresh,
}
