import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import type { SqliteDb } from "@/core/models/db-models";
import { batchInsertSpotifyShow, getLatestSpotifyShowAddedAt } from "../db/queries";
import type { SpotifyShowInsert } from "../db/schema";
import type { SpotifyPaginatedResponse, SpotifySavedShowItem } from "../models/models";
import { SPOTIFY_PAGE_SIZE, spotifyFetch, type SpotifyOffsetInputs } from "./spotify-utils";

export const syncSpotifyShowsStep = async (
  incremental: boolean,
  db: SqliteDb,
  inputs?: SpotifyOffsetInputs,
  syncTaskId?: string,
): Promise<void> => {
  const latestAddedAt = incremental ? await getLatestSpotifyShowAddedAt(db) : null;
  const offset = inputs?.offset ?? 0;
  let curOffset = offset;

  while (true) {
    let page: SpotifyPaginatedResponse<SpotifySavedShowItem>;
    try {
      page = await retry(async () => {
        const res = await spotifyFetch(`/me/shows?limit=${SPOTIFY_PAGE_SIZE}&offset=${curOffset}`, db);
        if (!res.ok) throw new Error(await res.text());
        return await res.json() as SpotifyPaginatedResponse<SpotifySavedShowItem>;
      });
    } catch (e) {
      await upsertSyncTask({
        id: syncTaskId,
        integration: "spotify",
        status: "FAILED",
        step: "spotify-sync-shows",
        inputs: { offset: curOffset },
        error: String(e),
      }, db);
      break;
    }

    const items = page.items ?? [];
    const fresh = latestAddedAt
      ? items.filter((item) => item.added_at > latestAddedAt)
      : items;

    const rows: SpotifyShowInsert[] = fresh.map((item) => ({
      showId: item.show.id,
      name: item.show.name,
      description: item.show.description,
      publisher: item.show.publisher,
      totalEpisodes: item.show.total_episodes,
      addedAt: item.added_at,
      spotifyUrl: item.show.external_urls?.spotify,
    }));

    try {
      await batchInsertSpotifyShow(rows, db);
      const nextOffset = curOffset + SPOTIFY_PAGE_SIZE;
      const hasMore = items.length >= SPOTIFY_PAGE_SIZE && nextOffset < page.total
        && !(incremental && fresh.length < items.length);
      await upsertSyncTask({
        id: syncTaskId,
        integration: "spotify",
        status: "SUCCESS",
        step: "spotify-sync-shows",
        inputs: hasMore ? { offset: nextOffset } : {},
      }, db);
    } catch (e) {
      await upsertSyncTask({
        id: syncTaskId,
        integration: "spotify",
        status: "FAILED",
        step: "spotify-sync-shows",
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
