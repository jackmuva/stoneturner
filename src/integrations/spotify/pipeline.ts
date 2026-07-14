import type { StepMapping, SyncStepPipeline } from "@/core/models/models";
import { bindAgentExplore, bindIndexVector } from "@/core/services/pipeline-helpers";
import { parseSpotifyStep } from "./sync-steps/parse-step";
import { syncSpotifyEpisodesStep } from "./sync-steps/sync-episodes-step";
import { syncSpotifyPlaylistTracksStep } from "./sync-steps/sync-playlist-tracks-step";
import { syncSpotifyPlaylistsStep } from "./sync-steps/sync-playlists-step";
import { syncSpotifySavedTracksStep } from "./sync-steps/sync-saved-tracks-step";
import { syncSpotifyShowsStep } from "./sync-steps/sync-shows-step";
import { syncSpotifyUserStep } from "./sync-steps/sync-user-step";

const syncUser: StepMapping = { "spotify-sync-user": syncSpotifyUserStep };
const syncPlaylists: StepMapping = { "spotify-sync-playlists": syncSpotifyPlaylistsStep };
const syncPlaylistTracks: StepMapping = { "spotify-sync-playlist-tracks": syncSpotifyPlaylistTracksStep };
const syncSavedTracks: StepMapping = { "spotify-sync-saved-tracks": syncSpotifySavedTracksStep };
const syncShows: StepMapping = { "spotify-sync-shows": syncSpotifyShowsStep };
const syncEpisodes: StepMapping = { "spotify-sync-episodes": syncSpotifyEpisodesStep };
const parse: StepMapping = { parse: parseSpotifyStep };
const indexVector: StepMapping = { "index-vector": bindIndexVector("spotify") };
const agentExplore: StepMapping = { "agent-explore": bindAgentExplore("spotify") };

export const spotifyPipeline: SyncStepPipeline = [
  [syncUser],
  [syncPlaylists],
  [syncPlaylistTracks],
  [syncSavedTracks],
  [syncShows],
  [syncEpisodes],
  [parse],
  [indexVector],
  [agentExplore],
];
