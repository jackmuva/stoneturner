import type { Integration } from "@/core/models/models";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { slackConfig } from "./config";
import { handleOauthRedirect, refreshSlackTokens } from "./sync-steps/slack-utils";
import { syncChannels } from "./sync-steps/sync-channels";
import { syncUsers } from "./sync-steps/sync-users";
import { syncMessages } from "./sync-steps/sync-messages";
import { syncThreadReplies } from "./sync-steps/sync-thread-replies";
import { parseSlackMessages } from "./sync-steps/parse-message-threads";
import { deleteAllSlackData } from "./db/queries";
import type { SqliteDb } from "@/core/models/db-models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { agentExploreContextStep } from "@/core/services/agent-explore-context-step";

export const syncSlackPipeline = async (incremental: boolean = true, db: SqliteDb) => {
  await syncChannels(incremental, db);
  await syncUsers(incremental, db);
  await syncMessages(incremental, db);
  await syncThreadReplies(incremental, db);
  await parseSlackMessages(incremental, db);
  await indexVectorDbStep(incremental, db, { integration: "slack" });
  await agentExploreContextStep(incremental, db, { integration: "slack" });
};

export const slackIntegration: Integration = {
  config: slackConfig,
  sync: async (db: SqliteDb) => await syncSlackPipeline(false, db),
  syncUpdates: async (db: SqliteDb) => await syncSlackPipeline(true, db),
  deleteSync: async (db: SqliteDb) => {
    await deleteAllSlackData(db);
    await deleteSyncTasksByIntegration("slack", db);
    await deleteMdArtifactsByIntegration("slack", db);
    await deleteEmbeddingByIntegration("slack", db);
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: refreshSlackTokens,
};
