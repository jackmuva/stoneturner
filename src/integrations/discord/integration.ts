import type { Integration } from "@/core/models/models";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { discordConfig } from "./config";
import { handleOauthRedirect, refreshDiscordTokens } from "./sync-steps/discord-utils";
import { syncChannels } from "./sync-steps/sync-channels";
import { syncMessages } from "./sync-steps/sync-messages";
import { parseDiscordMessages } from "./sync-steps/parse-message-threads";
import { batchInsertDiscordGuild, deleteAllDiscordData } from "./db/queries";

export const syncDiscordPipeline = async (incremental: boolean = true) => {
  await syncChannels();
  await syncMessages(incremental);
  await parseDiscordMessages(incremental);
  await indexVectorDbStep("discord", incremental);
}

export const discordIntegration: Integration = {
  config: discordConfig,
  sync: async () => await syncDiscordPipeline(false),
  syncUpdates: async () => await syncDiscordPipeline(true),
  deleteSync: async () => {
    await deleteAllDiscordData();
    await deleteSyncTasksByIntegration("discord");
    await deleteMdArtifactsByIntegration("discord");
    await deleteEmbeddingByIntegration("discord");
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: refreshDiscordTokens,
}
