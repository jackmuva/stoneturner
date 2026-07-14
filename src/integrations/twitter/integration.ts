import type { Integration } from "@/core/models/models";
import type { SqliteDb } from "@/core/models/db-models";
import { deleteMdArtifactsByIntegration, deleteSourceContextByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { twitterConfig } from "./config";
import { deleteTwitterData } from "./db/queries";
import {
  handleTwitterOauthRedirect,
  handleTwitterRefresh,
} from "./sync-steps/twitter-utils";
import { twitterPipeline } from "./pipeline";

export const twitterIntegration: Integration = {
  config: twitterConfig,
  syncPipeline: twitterPipeline,
  deleteSync: async (db: SqliteDb) => {
    await deleteTwitterData(db);
    await deleteSyncTasksByIntegration("twitter", db);
    await deleteMdArtifactsByIntegration("twitter", db);
    await deleteEmbeddingByIntegration("twitter", db);
    await deleteSourceContextByIntegration("twitter", db);
  },
  handleRedirect: handleTwitterOauthRedirect,
  refreshAccessTokens: handleTwitterRefresh,
};
