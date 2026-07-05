import type { IntegrationSteps } from "@/core/models/models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { asInputs, resumeCursor, resumeOffset } from "@/integrations/retry-step-utils";
import { parseSpotifyStep } from "./sync-steps/parse-step";
import { syncSpotifyEpisodesStep } from "./sync-steps/sync-episodes-step";
import { syncSpotifyPlaylistTracksStep } from "./sync-steps/sync-playlist-tracks-step";
import { syncSpotifyPlaylistsStep } from "./sync-steps/sync-playlists-step";
import { syncSpotifySavedTracksStep } from "./sync-steps/sync-saved-tracks-step";
import { syncSpotifyShowsStep } from "./sync-steps/sync-shows-step";
import { syncSpotifyUserStep } from "./sync-steps/sync-user-step";
import type { SpotifyEpisodesCursor, SpotifyOffsetCursor, SpotifyParseCursor, SpotifyPlaylistTracksCursor } from "./sync-steps/spotify-utils";

export const spotifySteps: IntegrationSteps = {
  "spotify-sync-user": async (db, _inputs, syncTaskId) => { await syncSpotifyUserStep(db, syncTaskId); },
  "spotify-sync-playlists": (db, inputs, syncTaskId) => syncSpotifyPlaylistsStep(false, db, resumeCursor(inputs) as SpotifyOffsetCursor | undefined, syncTaskId),
  "spotify-sync-playlist-tracks": async (db, inputs, syncTaskId) => {
    const user = await syncSpotifyUserStep(db);
    await syncSpotifyPlaylistTracksStep(false, db, user, resumeCursor(inputs) as SpotifyPlaylistTracksCursor | undefined, syncTaskId);
  },
  "spotify-sync-saved-tracks": (db, inputs, syncTaskId) => syncSpotifySavedTracksStep(false, db, resumeCursor(inputs) as SpotifyOffsetCursor | undefined, syncTaskId),
  "spotify-sync-shows": (db, inputs, syncTaskId) => syncSpotifyShowsStep(false, db, resumeCursor(inputs) as SpotifyOffsetCursor | undefined, syncTaskId),
  "spotify-sync-episodes": async (db, inputs, syncTaskId) => {
    const user = await syncSpotifyUserStep(db);
    await syncSpotifyEpisodesStep(false, db, user, resumeCursor(inputs) as SpotifyEpisodesCursor | undefined, syncTaskId);
  },
  "parse": (db, inputs, syncTaskId) => {
    const obj = asInputs(inputs);
    const cursor = obj?.cursor ?? (obj?.type ? obj : undefined);
    return parseSpotifyStep(db, cursor as SpotifyParseCursor | undefined, syncTaskId);
  },
  "index-vector": (db, inputs, syncTaskId) => indexVectorDbStep("spotify", true, db, resumeOffset(inputs), syncTaskId),
};
