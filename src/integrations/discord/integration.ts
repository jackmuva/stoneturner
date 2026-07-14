import type { Integration } from "@/core/models/models";
import { deleteMdArtifactsByIntegration, deleteSourceContextByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { discordConfig } from "./config";
import { handleOauthRedirect, refreshDiscordTokens } from "./sync-steps/discord-utils";
import { deleteAllDiscordData } from "./db/queries";
import type { SqliteDb } from "@/core/models/db-models";
import { discordPipeline } from "./pipeline";

export const discordIntegration: Integration = {
  config: discordConfig,
  syncPipeline: discordPipeline,
  deleteSync: async (db: SqliteDb) => {
    await deleteAllDiscordData(db);
    await deleteSyncTasksByIntegration("discord", db);
    await deleteMdArtifactsByIntegration("discord", db);
    await deleteEmbeddingByIntegration("discord", db);
    await deleteSourceContextByIntegration("discord", db);
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: refreshDiscordTokens,
};
