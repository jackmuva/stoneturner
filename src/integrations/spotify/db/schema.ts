import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const spotifyPlaylist = sqliteTable("spotifyPlaylist", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  playlistId: text("playlistId").unique().notNull(),
  name: text("name"),
  description: text("description"),
  ownerDisplayName: text("ownerDisplayName"),
  snapshotId: text("snapshotId"),
  trackCount: integer("trackCount"),
  isPublic: integer("isPublic", { mode: "boolean" }),
  isCollaborative: integer("isCollaborative", { mode: "boolean" }),
  spotifyUrl: text("spotifyUrl"),
}, (table) => [
  uniqueIndex("spotifyPlaylist_playlistId_unique_idx").on(table.playlistId),
]);

export type SpotifyPlaylistSelect = InferSelectModel<typeof spotifyPlaylist>;
export type SpotifyPlaylistInsert = InferInsertModel<typeof spotifyPlaylist>;

export const spotifyPlaylistTrack = sqliteTable("spotifyPlaylistTrack", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  itemKey: text("itemKey").unique().notNull(),
  playlistId: text("playlistId").notNull(),
  itemType: text("itemType").notNull(),
  itemId: text("itemId").notNull(),
  name: text("name"),
  artists: text("artists"),
  albumOrShow: text("albumOrShow"),
  addedAt: text("addedAt"),
  durationMs: integer("durationMs"),
  spotifyUrl: text("spotifyUrl"),
}, (table) => [
  uniqueIndex("spotifyPlaylistTrack_itemKey_unique_idx").on(table.itemKey),
]);

export type SpotifyPlaylistTrackSelect = InferSelectModel<typeof spotifyPlaylistTrack>;
export type SpotifyPlaylistTrackInsert = InferInsertModel<typeof spotifyPlaylistTrack>;

export const spotifySavedTrack = sqliteTable("spotifySavedTrack", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  trackId: text("trackId").unique().notNull(),
  name: text("name"),
  artists: text("artists"),
  albumName: text("albumName"),
  albumReleaseDate: text("albumReleaseDate"),
  addedAt: text("addedAt"),
  durationMs: integer("durationMs"),
  explicit: integer("explicit", { mode: "boolean" }),
  spotifyUrl: text("spotifyUrl"),
}, (table) => [
  uniqueIndex("spotifySavedTrack_trackId_unique_idx").on(table.trackId),
]);

export type SpotifySavedTrackSelect = InferSelectModel<typeof spotifySavedTrack>;
export type SpotifySavedTrackInsert = InferInsertModel<typeof spotifySavedTrack>;

export const spotifyShow = sqliteTable("spotifyShow", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  showId: text("showId").unique().notNull(),
  name: text("name"),
  description: text("description"),
  publisher: text("publisher"),
  totalEpisodes: integer("totalEpisodes"),
  addedAt: text("addedAt"),
  spotifyUrl: text("spotifyUrl"),
}, (table) => [
  uniqueIndex("spotifyShow_showId_unique_idx").on(table.showId),
]);

export type SpotifyShowSelect = InferSelectModel<typeof spotifyShow>;
export type SpotifyShowInsert = InferInsertModel<typeof spotifyShow>;

export const spotifyEpisode = sqliteTable("spotifyEpisode", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  episodeId: text("episodeId").unique().notNull(),
  showId: text("showId").notNull(),
  showName: text("showName"),
  name: text("name"),
  description: text("description"),
  releaseDate: text("releaseDate"),
  durationMs: integer("durationMs"),
  explicit: integer("explicit", { mode: "boolean" }),
  spotifyUrl: text("spotifyUrl"),
}, (table) => [
  uniqueIndex("spotifyEpisode_episodeId_unique_idx").on(table.episodeId),
]);

export type SpotifyEpisodeSelect = InferSelectModel<typeof spotifyEpisode>;
export type SpotifyEpisodeInsert = InferInsertModel<typeof spotifyEpisode>;
