import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import type { SqliteDb } from "@/core/models/db-models";
import { batchInsertSpotifyEpisode, getAllSpotifyShows, getSpotifyShowsWithoutEpisodes } from "../db/queries";
import type { SpotifyEpisodeInsert } from "../db/schema";
import type { SpotifyEpisode, SpotifyPaginatedResponse } from "../models/models";
import {
  SPOTIFY_PAGE_SIZE,
  spotifyFetch,
  stringsFromCursor,
  type SpotifyEpisodesCursor,
} from "./spotify-utils";

const STEP = "spotify-sync-episodes";

export const syncSpotifyEpisodesStep = async (
  incremental: boolean,
  db: SqliteDb,
  cursor?: SpotifyEpisodesCursor,
): Promise<void> => {
  const showsToSync = incremental
    ? await getSpotifyShowsWithoutEpisodes(db)
    : await getAllSpotifyShows(db);

  const showIds = stringsFromCursor(
    showsToSync.map((show) => show.showId),
    cursor?.showId,
  );

  for (const showId of showIds) {
    const show = showsToSync.find((s) => s.showId === showId);
    let offset = cursor?.showId === showId ? cursor.offset : 0;

    while (true) {
      try {
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
          showName: episode.show?.name ?? show?.name,
          name: episode.name,
          description: episode.description ?? episode.html_description?.replace(/<[^>]+>/g, " "),
          releaseDate: episode.release_date,
          durationMs: episode.duration_ms,
          explicit: episode.explicit,
          spotifyUrl: episode.external_urls?.spotify,
        }));

        await batchInsertSpotifyEpisode(rows, db);

        const nextOffset = offset + SPOTIFY_PAGE_SIZE;
        const hasMore = (page.items ?? []).length >= SPOTIFY_PAGE_SIZE && nextOffset < page.total;
        const nextCursor: SpotifyEpisodesCursor | null = hasMore
          ? { showId, offset: nextOffset }
          : null;

        await upsertSyncTask({
          integration: "spotify",
          status: "SUCCESS",
          step: STEP,
          inputs: nextCursor
            ? { cursor: nextCursor, count: rows.length }
            : { showId, count: rows.length },
        }, db);

        if (!hasMore) break;
        offset = nextOffset;
        if (cursor !== undefined) break;
      } catch (e) {
        await upsertSyncTask({
          integration: "spotify",
          status: "FAILED",
          step: STEP,
          inputs: { cursor: { showId, offset }, error: String(e) },
        }, db);
        break;
      }
    }

    if (cursor !== undefined) break;
  }
};
