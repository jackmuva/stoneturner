import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import type { SqliteDb } from "@/core/models/db-models";
import { batchInsertSpotifyEpisode, getAllSpotifyShows, getSpotifyShowsWithoutEpisodes } from "../db/queries";
import type { SpotifyEpisodeInsert } from "../db/schema";
import type { SpotifyEpisode, SpotifyPaginatedResponse, SpotifyUserProfile } from "../models/models";
import {
  SPOTIFY_PAGE_SIZE,
  spotifyFetch,
  stringsFromCursor,
  type SpotifyEpisodesCursor,
  type SpotifyEpisodesInputs,
} from "./spotify-utils";
import { fetchSpotifyUser } from "./sync-user-step";

const STEP = "spotify-sync-episodes";

export const syncSpotifyEpisodesStep = async (
  incremental: boolean,
  db: SqliteDb,
  inputs?: SpotifyEpisodesInputs,
  syncTaskId?: string,
): Promise<void> => {
  const user = await fetchSpotifyUser(db);
  const cursor = inputs?.cursor;
  const showsToSync = incremental
    ? await getSpotifyShowsWithoutEpisodes(db)
    : await getAllSpotifyShows(db);

  const showIds = stringsFromCursor(
    showsToSync.map((show) => show.showId),
    cursor?.showId,
  );

  const marketParam = user?.country ? `&market=${user.country}` : "";

  for (const showId of showIds) {
    const show = showsToSync.find((s) => s.showId === showId);
    let offset = cursor?.showId === showId ? cursor.offset : 0;

    while (true) {
      try {
        const page = await retry(async () => {
          const res = await spotifyFetch(
            `/shows/${showId}/episodes?limit=${SPOTIFY_PAGE_SIZE}&offset=${offset}${marketParam}`,
            db,
          );
          if (!res.ok) throw new Error(await res.text());
          return await res.json() as SpotifyPaginatedResponse<SpotifyEpisode>;
        });

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
          id: syncTaskId,
          integration: "spotify",
          status: "SUCCESS",
          error: null,
          step: STEP,
          inputs: nextCursor
            ? { cursor: nextCursor }
            : { showId },
        }, db);

        if (!hasMore) break;
        offset = nextOffset;
        if (inputs !== undefined) break;
      } catch (e) {
        await upsertSyncTask({
          id: syncTaskId,
          integration: "spotify",
          status: "FAILED",
          step: STEP,
          inputs: { cursor: { showId, offset } },
          error: String(e),
        }, db);
        break;
      }
    }

    if (inputs !== undefined) break;
  }
};
