import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import type { SqliteDb } from "@/core/models/db-models";
import { batchInsertSpotifyPlaylist } from "../db/queries";
import type { SpotifyPlaylistInsert } from "../db/schema";
import type { SpotifyPaginatedResponse, SpotifyPlaylist } from "../models/models";
import { SPOTIFY_PAGE_SIZE, spotifyFetch } from "./spotify-utils";

export const syncSpotifyPlaylistsStep = async (_incremental: boolean, db: SqliteDb): Promise<void> => {
  let offset = 0;

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
        inputs: { offset, error: String(e) },
      }, db);
      break;
    }

    const items = page.items ?? [];
    const rows: SpotifyPlaylistInsert[] = items.map((p) => ({
      playlistId: p.id,
      name: p.name,
      description: p.description,
      ownerDisplayName: p.owner.display_name ?? p.owner.id,
      snapshotId: p.snapshot_id,
      trackCount: p.tracks.total,
      isPublic: p.public ?? false,
      isCollaborative: p.collaborative,
      spotifyUrl: p.external_urls?.spotify,
    }));

    try {
      await batchInsertSpotifyPlaylist(rows, db);
      await upsertSyncTask({
        integration: "spotify",
        status: "SUCCESS",
        step: "spotify-sync-playlists",
        inputs: { offset, count: rows.length },
      }, db);
    } catch (e) {
      await upsertSyncTask({
        integration: "spotify",
        status: "FAILED",
        step: "spotify-sync-playlists",
        inputs: { offset, error: String(e) },
      }, db);
    }

    if (items.length < SPOTIFY_PAGE_SIZE) break;
    offset += SPOTIFY_PAGE_SIZE;
    if (offset >= page.total) break;
  }
};
