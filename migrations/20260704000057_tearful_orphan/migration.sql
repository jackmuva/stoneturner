CREATE TABLE `spotifyEpisode` (
	`id` text PRIMARY KEY,
	`episodeId` text NOT NULL,
	`showId` text NOT NULL,
	`showName` text,
	`name` text,
	`description` text,
	`releaseDate` text,
	`durationMs` integer,
	`explicit` integer,
	`spotifyUrl` text
);
--> statement-breakpoint
CREATE TABLE `spotifyPlaylist` (
	`id` text PRIMARY KEY,
	`playlistId` text NOT NULL,
	`name` text,
	`description` text,
	`ownerDisplayName` text,
	`snapshotId` text,
	`trackCount` integer,
	`isPublic` integer,
	`isCollaborative` integer,
	`spotifyUrl` text
);
--> statement-breakpoint
CREATE TABLE `spotifyPlaylistTrack` (
	`id` text PRIMARY KEY,
	`itemKey` text NOT NULL,
	`playlistId` text NOT NULL,
	`itemType` text NOT NULL,
	`itemId` text NOT NULL,
	`name` text,
	`artists` text,
	`albumOrShow` text,
	`addedAt` text,
	`durationMs` integer,
	`spotifyUrl` text
);
--> statement-breakpoint
CREATE TABLE `spotifySavedTrack` (
	`id` text PRIMARY KEY,
	`trackId` text NOT NULL,
	`name` text,
	`artists` text,
	`albumName` text,
	`albumReleaseDate` text,
	`addedAt` text,
	`durationMs` integer,
	`explicit` integer,
	`spotifyUrl` text
);
--> statement-breakpoint
CREATE TABLE `spotifyShow` (
	`id` text PRIMARY KEY,
	`showId` text NOT NULL,
	`name` text,
	`description` text,
	`publisher` text,
	`totalEpisodes` integer,
	`addedAt` text,
	`spotifyUrl` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spotifyEpisode_episodeId_unique_idx` ON `spotifyEpisode` (`episodeId`);--> statement-breakpoint
CREATE UNIQUE INDEX `spotifyPlaylist_playlistId_unique_idx` ON `spotifyPlaylist` (`playlistId`);--> statement-breakpoint
CREATE UNIQUE INDEX `spotifyPlaylistTrack_itemKey_unique_idx` ON `spotifyPlaylistTrack` (`itemKey`);--> statement-breakpoint
CREATE UNIQUE INDEX `spotifySavedTrack_trackId_unique_idx` ON `spotifySavedTrack` (`trackId`);--> statement-breakpoint
CREATE UNIQUE INDEX `spotifyShow_showId_unique_idx` ON `spotifyShow` (`showId`);