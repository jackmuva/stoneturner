import { upsertSyncTask } from "@/core/db/queries/queries";
import { withSyncTaskId } from "@/integrations/retry-step-utils";
import { retry } from "@/lib/utils";
import type { SqliteDb } from "@/core/models/db-models";
import { batchInsertSpotifySavedTrack, getLatestSpotifySavedTrackAddedAt } from "../db/queries";
import type { SpotifySavedTrackInsert } from "../db/schema";
import type { SpotifyPaginatedResponse, SpotifySavedTrackItem } from "../models/models";
import { formatArtists, SPOTIFY_PAGE_SIZE, spotifyFetch, type SpotifyOffsetCursor } from "./spotify-utils";

export const syncSpotifySavedTracksStep = async (
  incremental: boolean,
  db: SqliteDb,
  cursor?: SpotifyOffsetCursor,
  syncTaskId?: string,
): Promise<void> => {
  const latestAddedAt = incremental ? await getLatestSpotifySavedTrackAddedAt(db) : null;
  let offset = cursor ?? 0;

  while (true) {
    let page: SpotifyPaginatedResponse<SpotifySavedTrackItem>;
    try {
      page = await retry(async () => {
        const res = await spotifyFetch(`/me/tracks?limit=${SPOTIFY_PAGE_SIZE}&offset=${offset}`, db);
        if (!res.ok) throw new Error(await res.text());
        return await res.json() as SpotifyPaginatedResponse<SpotifySavedTrackItem>;
      });
    } catch (e) {
      await upsertSyncTask(withSyncTaskId({
        integration: "spotify",
        status: "FAILED",
        step: "spotify-sync-saved-tracks",
        inputs: { cursor: offset },
        error: String(e),
      }, syncTaskId), db);
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
      const nextOffset = offset + SPOTIFY_PAGE_SIZE;
      const hasMore = items.length >= SPOTIFY_PAGE_SIZE && nextOffset < page.total
        && !(incremental && fresh.length < items.length);
      await upsertSyncTask(withSyncTaskId({
        integration: "spotify",
        status: "SUCCESS",
        step: "spotify-sync-saved-tracks",
        inputs: hasMore ? { cursor: nextOffset } : {},
      }, syncTaskId), db);
    } catch (e) {
      await upsertSyncTask(withSyncTaskId({
        integration: "spotify",
        status: "FAILED",
        step: "spotify-sync-saved-tracks",
        inputs: { cursor: offset },
        error: String(e),
      }, syncTaskId), db);
      break;
    }

    if (items.length < SPOTIFY_PAGE_SIZE) break;
    if (incremental && fresh.length < items.length) break;
    offset += SPOTIFY_PAGE_SIZE;
    if (offset >= page.total) break;
    if (cursor !== undefined) break;
  }
};
