import { desc, eq, inArray, sql } from "drizzle-orm";
import { PAGE_SIZE } from "@/lib/constants";
import type { SqliteDb } from "@/core/models/db-models";
import {
  spotifyPlaylist, type SpotifyPlaylistInsert, type SpotifyPlaylistSelect,
  spotifyPlaylistTrack, type SpotifyPlaylistTrackInsert, type SpotifyPlaylistTrackSelect,
  spotifySavedTrack, type SpotifySavedTrackInsert, type SpotifySavedTrackSelect,
  spotifyShow, type SpotifyShowInsert, type SpotifyShowSelect,
  spotifyEpisode, type SpotifyEpisodeInsert, type SpotifyEpisodeSelect,
} from "./schema";

export const batchInsertSpotifyPlaylist = async (rows: SpotifyPlaylistInsert[], db: SqliteDb): Promise<void> => {
  if (rows.length === 0) return;
  await db.insert(spotifyPlaylist)
    .values(rows)
    .onConflictDoUpdate({
      target: spotifyPlaylist.playlistId,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        ownerDisplayName: sql`excluded.ownerDisplayName`,
        ownerId: sql`excluded.ownerId`,
        snapshotId: sql`excluded.snapshotId`,
        trackCount: sql`excluded.trackCount`,
        isPublic: sql`excluded.isPublic`,
        isCollaborative: sql`excluded.isCollaborative`,
        spotifyUrl: sql`excluded.spotifyUrl`,
      },
    });
};

export const getSpotifyPlaylists = async (offset: number = 0, db: SqliteDb): Promise<SpotifyPlaylistSelect[]> => {
  return await db.select()
    .from(spotifyPlaylist)
    .limit(PAGE_SIZE)
    .offset(offset);
};

export const getSpotifyPlaylistsByIds = async (playlistIds: string[], db: SqliteDb): Promise<SpotifyPlaylistSelect[]> => {
  if (playlistIds.length === 0) return [];
  return await db.select()
    .from(spotifyPlaylist)
    .where(inArray(spotifyPlaylist.playlistId, playlistIds));
};

export const getAllSpotifyPlaylists = async (db: SqliteDb): Promise<SpotifyPlaylistSelect[]> => {
  return await db.select().from(spotifyPlaylist);
};

export const batchInsertSpotifyPlaylistTrack = async (rows: SpotifyPlaylistTrackInsert[], db: SqliteDb): Promise<void> => {
  if (rows.length === 0) return;
  await db.insert(spotifyPlaylistTrack)
    .values(rows)
    .onConflictDoUpdate({
      target: spotifyPlaylistTrack.itemKey,
      set: {
        name: sql`excluded.name`,
        artists: sql`excluded.artists`,
        albumOrShow: sql`excluded.albumOrShow`,
        addedAt: sql`excluded.addedAt`,
        durationMs: sql`excluded.durationMs`,
        spotifyUrl: sql`excluded.spotifyUrl`,
      },
    });
};

export const deleteSpotifyPlaylistTracks = async (playlistId: string, db: SqliteDb): Promise<void> => {
  await db.delete(spotifyPlaylistTrack).where(sql`"playlistId" = ${playlistId}`);
};

export const getSpotifyPlaylistTracks = async (playlistId: string, db: SqliteDb): Promise<SpotifyPlaylistTrackSelect[]> => {
  return await db.select()
    .from(spotifyPlaylistTrack)
    .where(eq(spotifyPlaylistTrack.playlistId, playlistId));
};

export const batchInsertSpotifySavedTrack = async (rows: SpotifySavedTrackInsert[], db: SqliteDb): Promise<void> => {
  if (rows.length === 0) return;
  await db.insert(spotifySavedTrack)
    .values(rows)
    .onConflictDoUpdate({
      target: spotifySavedTrack.trackId,
      set: {
        name: sql`excluded.name`,
        artists: sql`excluded.artists`,
        albumName: sql`excluded.albumName`,
        albumReleaseDate: sql`excluded.albumReleaseDate`,
        addedAt: sql`excluded.addedAt`,
        durationMs: sql`excluded.durationMs`,
        explicit: sql`excluded.explicit`,
        spotifyUrl: sql`excluded.spotifyUrl`,
      },
    });
};

export const getSpotifySavedTracks = async (offset: number = 0, db: SqliteDb): Promise<SpotifySavedTrackSelect[]> => {
  return await db.select()
    .from(spotifySavedTrack)
    .limit(PAGE_SIZE)
    .offset(offset);
};

export const getLatestSpotifySavedTrackAddedAt = async (db: SqliteDb): Promise<string | null> => {
  const [row] = await db.select()
    .from(spotifySavedTrack)
    .orderBy(desc(spotifySavedTrack.addedAt))
    .limit(1);
  return row?.addedAt ?? null;
};

export const batchInsertSpotifyShow = async (rows: SpotifyShowInsert[], db: SqliteDb): Promise<void> => {
  if (rows.length === 0) return;
  await db.insert(spotifyShow)
    .values(rows)
    .onConflictDoUpdate({
      target: spotifyShow.showId,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        publisher: sql`excluded.publisher`,
        totalEpisodes: sql`excluded.totalEpisodes`,
        addedAt: sql`excluded.addedAt`,
        spotifyUrl: sql`excluded.spotifyUrl`,
      },
    });
};

export const getSpotifyShows = async (offset: number = 0, db: SqliteDb): Promise<SpotifyShowSelect[]> => {
  return await db.select()
    .from(spotifyShow)
    .limit(PAGE_SIZE)
    .offset(offset);
};

export const getAllSpotifyShows = async (db: SqliteDb): Promise<SpotifyShowSelect[]> => {
  return await db.select().from(spotifyShow);
};

export const getSpotifyShowsWithoutEpisodes = async (db: SqliteDb): Promise<SpotifyShowSelect[]> => {
  const shows = await db.select().from(spotifyShow);
  const episodes = await db.select({ showId: spotifyEpisode.showId }).from(spotifyEpisode);
  const showIdsWithEpisodes = new Set(episodes.map((e) => e.showId));
  return shows.filter((show) => !showIdsWithEpisodes.has(show.showId));
};

export const getLatestSpotifyShowAddedAt = async (db: SqliteDb): Promise<string | null> => {
  const [row] = await db.select()
    .from(spotifyShow)
    .orderBy(desc(spotifyShow.addedAt))
    .limit(1);
  return row?.addedAt ?? null;
};

export const batchInsertSpotifyEpisode = async (rows: SpotifyEpisodeInsert[], db: SqliteDb): Promise<void> => {
  if (rows.length === 0) return;
  await db.insert(spotifyEpisode)
    .values(rows)
    .onConflictDoUpdate({
      target: spotifyEpisode.episodeId,
      set: {
        showId: sql`excluded.showId`,
        showName: sql`excluded.showName`,
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        releaseDate: sql`excluded.releaseDate`,
        durationMs: sql`excluded.durationMs`,
        explicit: sql`excluded.explicit`,
        spotifyUrl: sql`excluded.spotifyUrl`,
      },
    });
};

export const getSpotifyEpisodes = async (offset: number = 0, db: SqliteDb): Promise<SpotifyEpisodeSelect[]> => {
  return await db.select()
    .from(spotifyEpisode)
    .limit(PAGE_SIZE)
    .offset(offset);
};

export const deleteSpotifyData = async (db: SqliteDb): Promise<void> => {
  await db.delete(spotifyEpisode);
  await db.delete(spotifyShow);
  await db.delete(spotifySavedTrack);
  await db.delete(spotifyPlaylistTrack);
  await db.delete(spotifyPlaylist);
};
