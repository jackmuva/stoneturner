import type { Integration } from "@/core/models/models";
import type { SqliteDb } from "@/core/models/db-models";
import { deleteMdArtifactsByIntegration, deleteSourceContextByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { notionConfig } from "./config";
import { handleNotionRefresh, handleOauthRedirect } from "./sync-steps/notion-utils";
import { deleteNotionData } from "./db/queries";
import { notionPipeline } from "./pipeline";

export const notionIntegration: Integration = {
  config: notionConfig,
  syncPipeline: notionPipeline,
  deleteSync: async (db: SqliteDb) => {
    await deleteNotionData(db);
    await deleteSyncTasksByIntegration("notion", db);
    await deleteMdArtifactsByIntegration("notion", db);
    await deleteEmbeddingByIntegration("notion", db);
    await deleteSourceContextByIntegration("notion", db);
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: handleNotionRefresh,
};
