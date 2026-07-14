import type { Integration } from "@/core/models/models";
import { deleteMdArtifactsByIntegration, deleteSourceContextByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { slackConfig } from "./config";
import { handleOauthRedirect, refreshSlackTokens } from "./sync-steps/slack-utils";
import { deleteAllSlackData } from "./db/queries";
import type { SqliteDb } from "@/core/models/db-models";
import { slackPipeline } from "./pipeline";

export const slackIntegration: Integration = {
  config: slackConfig,
  syncPipeline: slackPipeline,
  deleteSync: async (db: SqliteDb) => {
    await deleteAllSlackData(db);
    await deleteSyncTasksByIntegration("slack", db);
    await deleteMdArtifactsByIntegration("slack", db);
    await deleteEmbeddingByIntegration("slack", db);
    await deleteSourceContextByIntegration("slack", db);
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: refreshSlackTokens,
};
