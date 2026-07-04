import type { Integration } from "@/core/models/models";
import type { SqliteDb } from "@/core/models/db-models";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { twitterConfig } from "./config";
import { deleteTwitterData } from "./db/queries";
import { syncTwitterTweetsStep } from "./sync-steps/sync-tweets-step";
import { syncTwitterMentionsStep } from "./sync-steps/sync-mentions-step";
import { syncTwitterBookmarksStep } from "./sync-steps/sync-bookmarks-step";
import { parseTwitterStep } from "./sync-steps/parse-step";
import {
  handleTwitterInitiateOAuth,
  handleTwitterOauthRedirect,
  handleTwitterRefresh,
} from "./sync-steps/twitter-utils";

export const syncTwitterPipeline = async (incremental: boolean = false, db: SqliteDb) => {
  await Promise.all([
    syncTwitterTweetsStep(incremental, db),
    syncTwitterMentionsStep(incremental, db),
    syncTwitterBookmarksStep(incremental, db),
  ]);
  await parseTwitterStep(db);
  await indexVectorDbStep("twitter", incremental, db);
};

export const twitterIntegration: Integration = {
  config: twitterConfig,
  sync: async (db: SqliteDb) => await syncTwitterPipeline(false, db),
  syncUpdates: async (db: SqliteDb) => await syncTwitterPipeline(true, db),
  deleteSync: async (db: SqliteDb) => {
    await deleteTwitterData(db);
    await deleteSyncTasksByIntegration("twitter", db);
    await deleteMdArtifactsByIntegration("twitter", db);
    await deleteEmbeddingByIntegration("twitter", db);
  },
  initiateOAuth: handleTwitterInitiateOAuth,
  handleRedirect: handleTwitterOauthRedirect,
  refreshAccessTokens: handleTwitterRefresh,
};
