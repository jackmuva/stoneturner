import type { Integration } from "@/core/models/models";
import { deleteMdArtifactsByIntegration, deleteSourceContextByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { discordConfig } from "./config";
import { handleOauthRedirect, refreshDiscordTokens } from "./sync-steps/discord-utils";
import { syncChannels } from "./sync-steps/sync-channels";
import { syncMessages } from "./sync-steps/sync-messages";
import { parseDiscordMessages } from "./sync-steps/parse-message-threads";
import { deleteAllDiscordData } from "./db/queries";
import type { SqliteDb } from "@/core/models/db-models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { agentExploreContextStep } from "@/core/services/agent-explore-context-step";

export const syncDiscordPipeline = async (incremental: boolean = true, db: SqliteDb) => {
  await syncChannels(incremental, db);
  await syncMessages(incremental, db);
  await parseDiscordMessages(incremental, db);
  await indexVectorDbStep(incremental, db, { integration: "discord" });
  await agentExploreContextStep(incremental, db, { integration: "discord" });
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
    await deleteSourceContextByIntegration("discord", db);
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: refreshDiscordTokens,
}
