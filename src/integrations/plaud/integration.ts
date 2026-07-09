import type { Integration } from "@/core/models/models";
import { deleteMdArtifactsByIntegration, deleteSourceContextByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { plaudConfig } from "./config";
import { deletePlaudData } from "./db/queries";
import { syncPlaudFilesStep } from "./sync-steps/sync-files-step";
import { syncPlaudTranscriptsStep } from "./sync-steps/sync-transcripts-step";
import { parsePlaudStep } from "./sync-steps/parse-step";
import { handleOauthRedirect, handlePlaudRefresh } from "./sync-steps/plaud-utils";
import type { SqliteDb } from "@/core/models/db-models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { agentExploreContextStep } from "@/core/services/agent-explore-context-step";

export const syncPlaudPipeline = async (incremental: boolean = false, db: SqliteDb) => {
  await syncPlaudFilesStep(incremental, db);   // must run first — detail fetch needs file ids
  await syncPlaudTranscriptsStep(incremental, db);
  await parsePlaudStep(incremental, db);
  await indexVectorDbStep(incremental, db, { integration: "plaud" });
  await agentExploreContextStep(incremental, db, { integration: "plaud" });
}

export const plaudIntegration: Integration = {
  config: plaudConfig,
  sync: async (db: SqliteDb) => await syncPlaudPipeline(false, db),
  syncUpdates: async (db: SqliteDb) => await syncPlaudPipeline(true, db),
  deleteSync: async (db: SqliteDb) => {
    await deletePlaudData(db);
    await deleteSyncTasksByIntegration("plaud", db);
    await deleteMdArtifactsByIntegration("plaud", db);
    await deleteEmbeddingByIntegration("plaud", db);
    await deleteSourceContextByIntegration("plaud", db);
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: handlePlaudRefresh,
}
