import type { IntegrationSteps } from "@/core/models/models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { parseSpotifyStep } from "./sync-steps/parse-step";
import { syncSpotifyEpisodesStep } from "./sync-steps/sync-episodes-step";
import { syncSpotifyPlaylistTracksStep } from "./sync-steps/sync-playlist-tracks-step";
import { syncSpotifyPlaylistsStep } from "./sync-steps/sync-playlists-step";
import { syncSpotifySavedTracksStep } from "./sync-steps/sync-saved-tracks-step";
import { syncSpotifyShowsStep } from "./sync-steps/sync-shows-step";
import { syncSpotifyUserStep } from "./sync-steps/sync-user-step";

export const spotifySteps: IntegrationSteps = {
  "spotify-sync-user": syncSpotifyUserStep,
  "spotify-sync-playlists": syncSpotifyPlaylistsStep,
  "spotify-sync-playlist-tracks": syncSpotifyPlaylistTracksStep,
  "spotify-sync-saved-tracks": syncSpotifySavedTracksStep,
  "spotify-sync-shows": syncSpotifyShowsStep,
  "spotify-sync-episodes": syncSpotifyEpisodesStep,
  "parse": parseSpotifyStep,
  "index-vector": indexVectorDbStep,
};
