import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import type { SqliteDb } from "@/core/models/db-models";
import { batchInsertSpotifyEpisode, getAllSpotifyShows, getSpotifyShowsWithoutEpisodes } from "../db/queries";
import type { SpotifyEpisodeInsert } from "../db/schema";
import type { SpotifyEpisode, SpotifyPaginatedResponse } from "../models/models";
import { SPOTIFY_PAGE_SIZE, spotifyFetch } from "./spotify-utils";

export const syncSpotifyEpisodesStep = async (incremental: boolean, db: SqliteDb): Promise<void> => {
  const showsToSync = incremental
    ? await getSpotifyShowsWithoutEpisodes(db)
    : await getAllSpotifyShows(db);

  for (const show of showsToSync) {
    try {
      await syncShowEpisodes(show.showId, show.name, db);
      await upsertSyncTask({
        integration: "spotify",
        status: "SUCCESS",
        step: "spotify-sync-episodes",
        inputs: { showId: show.showId },
      }, db);
    } catch (e) {
      await upsertSyncTask({
        integration: "spotify",
        status: "FAILED",
        step: "spotify-sync-episodes",
        inputs: { showId: show.showId, error: String(e) },
      }, db);
    }
  }
};

const syncShowEpisodes = async (showId: string, showName: string | null, db: SqliteDb): Promise<void> => {
  let offset = 0;

  while (true) {
    const page = await retry(async () => {
      const res = await spotifyFetch(
        `/shows/${showId}/episodes?limit=${SPOTIFY_PAGE_SIZE}&offset=${offset}`,
        db,
      );
      if (!res.ok) throw new Error(await res.text());
      return await res.json() as SpotifyPaginatedResponse<SpotifyEpisode>;
    }, 3, 1);

    const rows: SpotifyEpisodeInsert[] = (page.items ?? []).map((episode) => ({
      episodeId: episode.id,
      showId,
      showName: episode.show?.name ?? showName,
      name: episode.name,
      description: episode.description ?? episode.html_description?.replace(/<[^>]+>/g, " "),
      releaseDate: episode.release_date,
      durationMs: episode.duration_ms,
      explicit: episode.explicit,
      spotifyUrl: episode.external_urls?.spotify,
    }));

    await batchInsertSpotifyEpisode(rows, db);

    if ((page.items ?? []).length < SPOTIFY_PAGE_SIZE) break;
    offset += SPOTIFY_PAGE_SIZE;
    if (offset >= page.total) break;
  }
};
