import type { Integration } from "@/core/models/models";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { discordConfig } from "./config";
import { handleOauthRedirect, refreshDiscordTokens } from "./sync-steps/discord-utils";
import { syncChannels } from "./sync-steps/sync-channels";
import { syncMessages } from "./sync-steps/sync-messages";
import { parseDiscordMessages } from "./sync-steps/parse-message-threads";
import { deleteAllDiscordData } from "./db/queries";
import type { SqliteDb } from "@/core/models/db-models";

export const syncDiscordPipeline = async (incremental: boolean = true, db: SqliteDb) => {
  await syncChannels(db);
  await syncMessages(incremental, db);
  await parseDiscordMessages(incremental, db);
  await indexVectorDbStep("discord", incremental, db);
}

export const discordIntegration: Integration = {
  config: discordConfig,
  sync: async (db: SqliteDb) => await syncDiscordPipeline(false, db),
  syncUpdates: async (db: SqliteDb) => await syncDiscordPipeline(true, db),
  deleteSync: async (db: SqliteDb) => {
    await deleteAllDiscordData(db);
    await deleteSyncTasksByIntegration("discord", db);
    await deleteMdArtifactsByIntegration("discord", db);
    await deleteEmbeddingByIntegration("discord", db);
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: refreshDiscordTokens,
}
