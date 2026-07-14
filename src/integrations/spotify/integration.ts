import type { Integration } from "@/core/models/models";
import { deleteMdArtifactsByIntegration, deleteSourceContextByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { spotifyConfig } from "./config";
import { deleteSpotifyData } from "./db/queries";
import { handleOauthRedirect, handleSpotifyRefresh } from "./sync-steps/spotify-utils";
import type { SqliteDb } from "@/core/models/db-models";
import { spotifyPipeline } from "./pipeline";

export const spotifyIntegration: Integration = {
  config: spotifyConfig,
  syncPipeline: spotifyPipeline,
  deleteSync: async (db: SqliteDb) => {
    await deleteSpotifyData(db);
    await deleteSyncTasksByIntegration("spotify", db);
    await deleteMdArtifactsByIntegration("spotify", db);
    await deleteEmbeddingByIntegration("spotify", db);
    await deleteSourceContextByIntegration("spotify", db);
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: handleSpotifyRefresh,
};
