CREATE TABLE `firecrawlPage` (
	`id` text PRIMARY KEY,
	`url` text NOT NULL,
	`sourceUrl` text,
	`title` text,
	`markdown` text,
	`html` text,
	`crawledAt` text
);
--> statement-breakpoint
CREATE TABLE `githubDiscussion` (
	`id` text PRIMARY KEY,
	`artifactId` text NOT NULL,
	`repo` text NOT NULL,
	`number` integer NOT NULL,
	`title` text,
	`body` text,
	`category` text,
	`author` text,
	`url` text,
	`comments` text,
	`createdAt` text
);
--> statement-breakpoint
CREATE TABLE `githubDoc` (
	`id` text PRIMARY KEY,
	`artifactId` text NOT NULL,
	`repo` text NOT NULL,
	`path` text NOT NULL,
	`content` text,
	`sha` text
);
--> statement-breakpoint
CREATE TABLE `githubIssue` (
	`id` text PRIMARY KEY,
	`artifactId` text NOT NULL,
	`repo` text NOT NULL,
	`number` integer NOT NULL,
	`title` text,
	`body` text,
	`state` text,
	`author` text,
	`labels` text,
	`comments` text,
	`htmlUrl` text,
	`createdAt` text,
	`updatedAt` text
);
--> statement-breakpoint
CREATE TABLE `githubPull` (
	`id` text PRIMARY KEY,
	`artifactId` text NOT NULL,
	`repo` text NOT NULL,
	`number` integer NOT NULL,
	`title` text,
	`body` text,
	`state` text,
	`author` text,
	`files` text,
	`reviewComments` text,
	`htmlUrl` text,
	`createdAt` text,
	`updatedAt` text
);
--> statement-breakpoint
CREATE TABLE `githubSourceFile` (
	`id` text PRIMARY KEY,
	`artifactId` text NOT NULL,
	`repo` text NOT NULL,
	`path` text NOT NULL,
	`sha` text,
	`size` integer,
	`isMarkdown` integer,
	`content` text
);
--> statement-breakpoint
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
CREATE TABLE `slackChannel` (
	`id` text PRIMARY KEY,
	`teamId` text NOT NULL,
	`name` text NOT NULL,
	`topic` text,
	`purpose` text,
	`numMembers` integer,
	`isArchived` integer DEFAULT false NOT NULL,
	`created` integer
);
--> statement-breakpoint
CREATE TABLE `slackMessage` (
	`id` text PRIMARY KEY,
	`channelId` text NOT NULL,
	`ts` text NOT NULL,
	`userId` text,
	`text` text NOT NULL,
	`threadTs` text,
	`isReply` integer DEFAULT false NOT NULL,
	`replyCount` integer,
	`latestReply` text,
	`subtype` text,
	`editedTs` text,
	`reactions` text,
	`attachments` text,
	`blocks` text,
	`botId` text
);
--> statement-breakpoint
CREATE TABLE `slackTeam` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`domain` text,
	`enterpriseId` text,
	`isEnterpriseInstall` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `slackUser` (
	`id` text PRIMARY KEY,
	`teamId` text NOT NULL,
	`name` text NOT NULL,
	`realName` text,
	`displayName` text,
	`isBot` integer DEFAULT false NOT NULL,
	`deleted` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE `integrationCredential` ADD `options` text;--> statement-breakpoint
CREATE INDEX `idx_md_artifacts_integration_date` ON `mdArtifacts` (`integration`,`artifactDate`);--> statement-breakpoint
CREATE UNIQUE INDEX `firecrawlPage_url_unique_idx` ON `firecrawlPage` (`url`);--> statement-breakpoint
CREATE UNIQUE INDEX `githubDiscussion_artifactId_unique_idx` ON `githubDiscussion` (`artifactId`);--> statement-breakpoint
CREATE UNIQUE INDEX `githubDoc_artifactId_unique_idx` ON `githubDoc` (`artifactId`);--> statement-breakpoint
CREATE UNIQUE INDEX `githubIssue_artifactId_unique_idx` ON `githubIssue` (`artifactId`);--> statement-breakpoint
CREATE UNIQUE INDEX `githubPull_artifactId_unique_idx` ON `githubPull` (`artifactId`);--> statement-breakpoint
CREATE UNIQUE INDEX `githubSourceFile_artifactId_unique_idx` ON `githubSourceFile` (`artifactId`);--> statement-breakpoint
CREATE UNIQUE INDEX `spotifyEpisode_episodeId_unique_idx` ON `spotifyEpisode` (`episodeId`);--> statement-breakpoint
CREATE UNIQUE INDEX `spotifyPlaylist_playlistId_unique_idx` ON `spotifyPlaylist` (`playlistId`);--> statement-breakpoint
CREATE UNIQUE INDEX `spotifyPlaylistTrack_itemKey_unique_idx` ON `spotifyPlaylistTrack` (`itemKey`);--> statement-breakpoint
CREATE UNIQUE INDEX `spotifySavedTrack_trackId_unique_idx` ON `spotifySavedTrack` (`trackId`);--> statement-breakpoint
CREATE UNIQUE INDEX `spotifyShow_showId_unique_idx` ON `spotifyShow` (`showId`);--> statement-breakpoint
CREATE UNIQUE INDEX `slackChannel_id_unique_idx` ON `slackChannel` (`id`);--> statement-breakpoint
CREATE INDEX `slackChannel_teamId_idx` ON `slackChannel` (`teamId`);--> statement-breakpoint
CREATE UNIQUE INDEX `slackMessage_channelId_ts_unique_idx` ON `slackMessage` (`channelId`,`ts`);--> statement-breakpoint
CREATE INDEX `slackMessage_channelId_idx` ON `slackMessage` (`channelId`);--> statement-breakpoint
CREATE INDEX `slackMessage_threadTs_idx` ON `slackMessage` (`threadTs`);--> statement-breakpoint
CREATE UNIQUE INDEX `slackTeam_id_unique_idx` ON `slackTeam` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `slackUser_id_unique_idx` ON `slackUser` (`id`);--> statement-breakpoint
CREATE INDEX `slackUser_teamId_idx` ON `slackUser` (`teamId`);