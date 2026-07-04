import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import type { SqliteDb } from "@/core/models/db-models";
import { batchInsertSpotifySavedTrack, getLatestSpotifySavedTrackAddedAt } from "../db/queries";
import type { SpotifySavedTrackInsert } from "../db/schema";
import type { SpotifyPaginatedResponse, SpotifySavedTrackItem } from "../models/models";
import { formatArtists, SPOTIFY_PAGE_SIZE, spotifyFetch } from "./spotify-utils";

export const syncSpotifySavedTracksStep = async (incremental: boolean, db: SqliteDb): Promise<void> => {
  const latestAddedAt = incremental ? await getLatestSpotifySavedTrackAddedAt(db) : null;
  let offset = 0;

  while (true) {
    let page: SpotifyPaginatedResponse<SpotifySavedTrackItem>;
    try {
      page = await retry(async () => {
        const res = await spotifyFetch(`/me/tracks?limit=${SPOTIFY_PAGE_SIZE}&offset=${offset}`, db);
        if (!res.ok) throw new Error(await res.text());
        return await res.json() as SpotifyPaginatedResponse<SpotifySavedTrackItem>;
      }, 3, 1);
    } catch (e) {
      await upsertSyncTask({
        integration: "spotify",
        status: "FAILED",
        step: "spotify-sync-saved-tracks",
        inputs: { offset, error: String(e) },
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
      await upsertSyncTask({
        integration: "spotify",
        status: "SUCCESS",
        step: "spotify-sync-saved-tracks",
        inputs: { offset, count: rows.length },
      }, db);
    } catch (e) {
      await upsertSyncTask({
        integration: "spotify",
        status: "FAILED",
        step: "spotify-sync-saved-tracks",
        inputs: { offset, error: String(e) },
      }, db);
    }

    if (items.length < SPOTIFY_PAGE_SIZE) break;
    if (incremental && fresh.length < items.length) break;
    offset += SPOTIFY_PAGE_SIZE;
    if (offset >= page.total) break;
  }
};
