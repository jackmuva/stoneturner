import type { Integration } from "@/core/models/models";
import type { SqliteDb } from "@/core/models/db-models";
import { deleteMdArtifactsByIntegration, deleteSourceContextByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { linearConfig } from "./config";
import { deleteLinearData } from "./db/queries";
import { handleLinearRefresh, handleOauthRedirect } from "./sync-steps/linear-utils";
import { linearPipeline } from "./pipeline";

export const linearIntegration: Integration = {
  config: linearConfig,
  syncPipeline: linearPipeline,
  deleteSync: async (db: SqliteDb) => {
    await deleteSyncTasksByIntegration("linear", db);
    await deleteMdArtifactsByIntegration("linear", db);
    await deleteEmbeddingByIntegration("linear", db);
    await deleteSourceContextByIntegration("linear", db);
    await deleteLinearData(db);
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: handleLinearRefresh,
};
