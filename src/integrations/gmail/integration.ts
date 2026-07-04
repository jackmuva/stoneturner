import type { Integration } from "@/core/models/models";
import type { SqliteDb } from "@/core/models/db-models";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { gmailConfig } from "./config";
import { deleteGmailData } from "./db/queries";
import { syncGmailMessagesStep } from "./sync-steps/sync-messages-step";
import { parseGmailStep } from "./sync-steps/parse-step";
import { handleOauthRedirect, handleGmailRefresh } from "./sync-steps/gmail-utils";

export const syncGmailPipeline = async (incremental: boolean = false, db: SqliteDb) => {
  await syncGmailMessagesStep(incremental, db);
  await parseGmailStep(db);
  await indexVectorDbStep("gmail", incremental, db);
};

export const gmailIntegration: Integration = {
  config: gmailConfig,
  sync: async (db: SqliteDb) => await syncGmailPipeline(false, db),
  syncUpdates: async (db: SqliteDb) => await syncGmailPipeline(true, db),
  deleteSync: async (db: SqliteDb) => {
    await deleteGmailData(db);
    await deleteSyncTasksByIntegration("gmail", db);
    await deleteMdArtifactsByIntegration("gmail", db);
    await deleteEmbeddingByIntegration("gmail", db);
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: handleGmailRefresh,
};
