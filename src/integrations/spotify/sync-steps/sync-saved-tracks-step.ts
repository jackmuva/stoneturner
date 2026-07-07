import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import type { SqliteDb } from "@/core/models/db-models";
import { batchInsertSpotifySavedTrack, getLatestSpotifySavedTrackAddedAt } from "../db/queries";
import type { SpotifySavedTrackInsert } from "../db/schema";
import type { SpotifyPaginatedResponse, SpotifySavedTrackItem } from "../models/models";
import { formatArtists, SPOTIFY_PAGE_SIZE, spotifyFetch, type SpotifyOffsetInputs } from "./spotify-utils";

export const syncSpotifySavedTracksStep = async (
  incremental: boolean,
  db: SqliteDb,
  inputs?: SpotifyOffsetInputs,
  syncTaskId?: string,
): Promise<void> => {
  const latestAddedAt = incremental ? await getLatestSpotifySavedTrackAddedAt(db) : null;
  const offset = inputs?.offset ?? 0;
  let curOffset = offset;

  while (true) {
    let page: SpotifyPaginatedResponse<SpotifySavedTrackItem>;
    try {
      page = await retry(async () => {
        const res = await spotifyFetch(`/me/tracks?limit=${SPOTIFY_PAGE_SIZE}&offset=${curOffset}`, db);
        if (!res.ok) throw new Error(await res.text());
        return await res.json() as SpotifyPaginatedResponse<SpotifySavedTrackItem>;
      });
    } catch (e) {
      await upsertSyncTask({
        id: syncTaskId,
        integration: "spotify",
        status: "FAILED",
        step: "spotify-sync-saved-tracks",
        inputs: { offset: curOffset },
        error: String(e),
      }, db);
      break;
    }

    const items = page.items ?? [];
    const fresh = latestAddedAt
      ? items.filter((item) => item.added_at > latestAddedAt)
      : items;

    const rows: SpotifySavedTrackInsert[] = fresh
      .filter((item) => item.track?.id)
      .map((item) => ({
        trackId: item.track!.id,
        name: item.track!.name,
        artists: formatArtists(item.track!.artists),
        albumName: item.track!.album?.name,
        albumReleaseDate: item.track!.album?.release_date,
        addedAt: item.added_at,
        durationMs: item.track!.duration_ms,
        explicit: item.track!.explicit,
        spotifyUrl: item.track!.external_urls?.spotify,
      }));

    try {
      await batchInsertSpotifySavedTrack(rows, db);
      const nextOffset = curOffset + SPOTIFY_PAGE_SIZE;
      const hasMore = items.length >= SPOTIFY_PAGE_SIZE && nextOffset < page.total
        && !(incremental && fresh.length < items.length);
      await upsertSyncTask({
        id: syncTaskId,
        integration: "spotify",
        status: "SUCCESS",
        error: null,
        step: "spotify-sync-saved-tracks",
        inputs: hasMore ? { offset: nextOffset } : {},
      }, db);
    } catch (e) {
      await upsertSyncTask({
        id: syncTaskId,
        integration: "spotify",
        status: "FAILED",
        step: "spotify-sync-saved-tracks",
        inputs: { offset: curOffset },
        error: String(e),
      }, db);
      break;
    }

    if (items.length < SPOTIFY_PAGE_SIZE) break;
    if (incremental && fresh.length < items.length) break;
    curOffset += SPOTIFY_PAGE_SIZE;
    if (curOffset >= page.total) break;
    if (inputs?.offset !== undefined) break;
  }
};
