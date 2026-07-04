import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import type { SqliteDb } from "@/core/models/db-models";
import {
  batchInsertSpotifyPlaylistTrack,
  deleteSpotifyPlaylistTracks,
  getAllSpotifyPlaylists,
} from "../db/queries";
import type { SpotifyPlaylistTrackInsert } from "../db/schema";
import type {
  SpotifyEpisode,
  SpotifyPaginatedResponse,
  SpotifyPlaylistItem,
  SpotifyTrack,
} from "../models/models";
import {
  formatArtists,
  SPOTIFY_PAGE_SIZE,
  spotifyFetch,
  stringsFromCursor,
  type SpotifyPlaylistTracksCursor,
} from "./spotify-utils";

const STEP = "spotify-sync-playlist-tracks";

const isTrack = (item: SpotifyTrack | SpotifyEpisode): item is SpotifyTrack => item.type === "track";
const isEpisode = (item: SpotifyTrack | SpotifyEpisode): item is SpotifyEpisode => item.type === "episode";

const getPlaylistsNeedingTrackSync = async (incremental: boolean, db: SqliteDb): Promise<string[]> => {
  const playlists = await getAllSpotifyPlaylists(db);
  if (!incremental) return playlists.map((p) => p.playlistId);

  const { getSpotifyPlaylistTracks } = await import("../db/queries");
  const needsSync: string[] = [];
  for (const playlist of playlists) {
    const tracks = await getSpotifyPlaylistTracks(playlist.playlistId, db);
    if (tracks.length === 0 || tracks.length !== (playlist.trackCount ?? 0)) {
      needsSync.push(playlist.playlistId);
    }
  }
  return needsSync;
};

export const syncSpotifyPlaylistTracksStep = async (
  incremental: boolean,
  db: SqliteDb,
  cursor?: SpotifyPlaylistTracksCursor,
): Promise<void> => {
  const playlistIds = stringsFromCursor(
    await getPlaylistsNeedingTrackSync(incremental, db),
    cursor?.playlistId,
  );

  for (const playlistId of playlistIds) {
    let offset = cursor?.playlistId === playlistId ? cursor.offset : 0;
    if (offset === 0) {
      await deleteSpotifyPlaylistTracks(playlistId, db);
    }

    while (true) {
      try {
        const page = await retry(async () => {
          const res = await spotifyFetch(
            `/playlists/${playlistId}/items?limit=${SPOTIFY_PAGE_SIZE}&offset=${offset}&additional_types=track,episode`,
            db,
          );
          if (!res.ok) throw new Error(await res.text());
          return await res.json() as SpotifyPaginatedResponse<SpotifyPlaylistItem>;
        }, 3, 1);

        const rows: SpotifyPlaylistTrackInsert[] = [];
        for (const item of page.items ?? []) {
          const media = item.track;
          if (!media) continue;

          if (isTrack(media)) {
            rows.push({
              itemKey: `${playlistId}:track:${media.id}:${item.added_at}`,
              playlistId,
              itemType: "track",
              itemId: media.id,
              name: media.name,
              artists: formatArtists(media.artists),
              albumOrShow: media.album?.name,
              addedAt: item.added_at,
              durationMs: media.duration_ms,
              spotifyUrl: media.external_urls?.spotify,
            });
          } else if (isEpisode(media)) {
            rows.push({
              itemKey: `${playlistId}:episode:${media.id}:${item.added_at}`,
              playlistId,
              itemType: "episode",
              itemId: media.id,
              name: media.name,
              artists: media.show?.publisher,
              albumOrShow: media.show?.name,
              addedAt: item.added_at,
              durationMs: media.duration_ms,
              spotifyUrl: media.external_urls?.spotify,
            });
          }
        }

        await batchInsertSpotifyPlaylistTrack(rows, db);

        const nextOffset = offset + SPOTIFY_PAGE_SIZE;
        const hasMore = (page.items ?? []).length >= SPOTIFY_PAGE_SIZE && nextOffset < page.total;
        const nextCursor: SpotifyPlaylistTracksCursor | null = hasMore
          ? { playlistId, offset: nextOffset }
          : null;

        await upsertSyncTask({
          integration: "spotify",
          status: "SUCCESS",
          step: STEP,
          inputs: nextCursor
            ? { cursor: nextCursor, count: rows.length }
            : { playlistId, count: rows.length },
        }, db);

        if (!hasMore) break;
        offset = nextOffset;
        if (cursor !== undefined) break;
      } catch (e) {
        await upsertSyncTask({
          integration: "spotify",
          status: "FAILED",
          step: STEP,
          inputs: { cursor: { playlistId, offset }, error: String(e) },
        }, db);
        break;
      }
    }

    if (cursor !== undefined) break;
  }
};
