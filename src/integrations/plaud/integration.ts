import type { Integration } from "@/core/models/models";
import { deleteMdArtifactsByIntegration, deleteSourceContextByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { plaudConfig } from "./config";
import { deletePlaudData } from "./db/queries";
import { handleOauthRedirect, handlePlaudRefresh } from "./sync-steps/plaud-utils";
import type { SqliteDb } from "@/core/models/db-models";
import { plaudPipeline } from "./pipeline";

export const plaudIntegration: Integration = {
  config: plaudConfig,
  syncPipeline: plaudPipeline,
  deleteSync: async (db: SqliteDb) => {
    await deletePlaudData(db);
    await deleteSyncTasksByIntegration("plaud", db);
    await deleteMdArtifactsByIntegration("plaud", db);
    await deleteEmbeddingByIntegration("plaud", db);
    await deleteSourceContextByIntegration("plaud", db);
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: handlePlaudRefresh,
};
