import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import type { SqliteDb } from "@/core/models/db-models";
import { batchInsertSpotifyPlaylist } from "../db/queries";
import type { SpotifyPlaylistInsert } from "../db/schema";
import type { SpotifyPaginatedResponse, SpotifyPlaylist } from "../models/models";
import { SPOTIFY_PAGE_SIZE, spotifyFetch, type SpotifyOffsetCursor } from "./spotify-utils";

export const syncSpotifyPlaylistsStep = async (_incremental: boolean, db: SqliteDb, cursor?: SpotifyOffsetCursor): Promise<void> => {
  let offset = cursor ?? 0;

  while (true) {
    let page: SpotifyPaginatedResponse<SpotifyPlaylist>;
    try {
      page = await retry(async () => {
        const res = await spotifyFetch(`/me/playlists?limit=${SPOTIFY_PAGE_SIZE}&offset=${offset}`, db);
        if (!res.ok) throw new Error(await res.text());
        return await res.json() as SpotifyPaginatedResponse<SpotifyPlaylist>;
      }, 3, 1);
    } catch (e) {
      await upsertSyncTask({
        integration: "spotify",
        status: "FAILED",
        step: "spotify-sync-playlists",
        inputs: { cursor: offset, error: String(e) },
      }, db);
      break;
    }

    const items = page.items ?? [];
    const rows: SpotifyPlaylistInsert[] = items.map((p) => ({
      playlistId: p.id,
      name: p.name,
      description: p.description,
      ownerDisplayName: p.owner.display_name ?? p.owner.id,
      ownerId: p.owner.id,
      snapshotId: p.snapshot_id,
      trackCount: p.items?.total ?? p.tracks?.total ?? 0,
      isPublic: p.public ?? false,
      isCollaborative: p.collaborative,
      spotifyUrl: p.external_urls?.spotify,
    }));

    try {
      await batchInsertSpotifyPlaylist(rows, db);
      const nextOffset = offset + SPOTIFY_PAGE_SIZE;
      const hasMore = items.length >= SPOTIFY_PAGE_SIZE && nextOffset < page.total;
      await upsertSyncTask({
        integration: "spotify",
        status: "SUCCESS",
        step: "spotify-sync-playlists",
        inputs: hasMore ? { cursor: nextOffset, count: rows.length } : { count: rows.length },
      }, db);
    } catch (e) {
      await upsertSyncTask({
        integration: "spotify",
        status: "FAILED",
        step: "spotify-sync-playlists",
        inputs: { cursor: offset, error: String(e) },
      }, db);
      break;
    }

    if (items.length < SPOTIFY_PAGE_SIZE) break;
    offset += SPOTIFY_PAGE_SIZE;
    if (offset >= page.total) break;
    if (cursor !== undefined) break;
  }
};
