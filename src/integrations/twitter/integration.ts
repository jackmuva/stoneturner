import type { Integration } from "@/core/models/models";
import type { SqliteDb } from "@/core/models/db-models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { agentExploreContextStep } from "@/core/services/agent-explore-context-step";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { twitterConfig } from "./config";
import { deleteTwitterData } from "./db/queries";
import { syncTwitterLikedTweetsStep } from "./sync-steps/sync-liked-tweets-step";
import { parseTwitterStep } from "./sync-steps/parse-step";
import {
  handleTwitterOauthRedirect,
  handleTwitterRefresh,
} from "./sync-steps/twitter-utils";

export const syncTwitterPipeline = async (incremental: boolean = false, db: SqliteDb) => {
  await syncTwitterLikedTweetsStep(incremental, db);
  await parseTwitterStep(incremental, db);
  await indexVectorDbStep(incremental, db, { integration: "twitter" });
  await agentExploreContextStep(incremental, db, { integration: "twitter" });
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
  handleRedirect: handleTwitterOauthRedirect,
  refreshAccessTokens: handleTwitterRefresh,
};
