import type { Integration } from "@/core/models/models";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { spotifyConfig } from "./config";
import { deleteSpotifyData } from "./db/queries";
import { syncSpotifyPlaylistsStep } from "./sync-steps/sync-playlists-step";
import { syncSpotifyPlaylistTracksStep } from "./sync-steps/sync-playlist-tracks-step";
import { syncSpotifySavedTracksStep } from "./sync-steps/sync-saved-tracks-step";
import { syncSpotifyShowsStep } from "./sync-steps/sync-shows-step";
import { syncSpotifyEpisodesStep } from "./sync-steps/sync-episodes-step";
import { parseSpotifyStep } from "./sync-steps/parse-step";
import { handleOauthRedirect, handleSpotifyRefresh } from "./sync-steps/spotify-utils";
import type { SqliteDb } from "@/core/models/db-models";

export const syncSpotifyPipeline = async (incremental: boolean = false, db: SqliteDb) => {
  await syncSpotifyPlaylistsStep(incremental, db);
  await syncSpotifyPlaylistTracksStep(incremental, db);
  await syncSpotifySavedTracksStep(incremental, db);
  await syncSpotifyShowsStep(incremental, db);
  await syncSpotifyEpisodesStep(incremental, db);
  await parseSpotifyStep(db);
  await indexVectorDbStep("spotify", incremental, db);
};

export const spotifyIntegration: Integration = {
  config: spotifyConfig,
  sync: async (db: SqliteDb) => await syncSpotifyPipeline(false, db),
  syncUpdates: async (db: SqliteDb) => await syncSpotifyPipeline(true, db),
  deleteSync: async (db: SqliteDb) => {
    await deleteSpotifyData(db);
    await deleteSyncTasksByIntegration("spotify", db);
    await deleteMdArtifactsByIntegration("spotify", db);
    await deleteEmbeddingByIntegration("spotify", db);
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: handleSpotifyRefresh,
};
