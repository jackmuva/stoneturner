CREATE TABLE `integrationCredential` (
	`id` text PRIMARY KEY,
	`integration` text NOT NULL,
	`integrationType` text NOT NULL,
	`apiKey` text,
	`accessToken` text,
	`refreshToken` text,
	`accessKey` text,
	`secretKey` text,
	`baseUrl` text
);
--> statement-breakpoint
CREATE TABLE `mdArtifacts` (
	`id` text PRIMARY KEY,
	`integrationArtifactId` text NOT NULL UNIQUE,
	`integration` text NOT NULL,
	`updateDate` text NOT NULL,
	`artifactDate` text,
	`markdown` text,
	`keyPoints` text,
	`questionsAnswered` text,
	`entities` text,
	`lastIndex` text
);
--> statement-breakpoint
CREATE TABLE `syncTask` (
	`id` text PRIMARY KEY,
	`integration` text NOT NULL,
	`updateDate` text NOT NULL,
	`status` text,
	`inputs` text,
	`step` text
);
--> statement-breakpoint
CREATE TABLE `contentEmbedding` (
	`id` text PRIMARY KEY,
	`integrationArtifactId` text NOT NULL,
	`integration` text NOT NULL,
	`updateDate` text NOT NULL,
	`artifactDate` text,
	`content` text,
	`entities` text,
	`embedding` blob
);
--> statement-breakpoint
CREATE TABLE `keyPointsEmbedding` (
	`id` text PRIMARY KEY,
	`integrationArtifactId` text NOT NULL,
	`integration` text NOT NULL,
	`updateDate` text NOT NULL,
	`artifactDate` text,
	`content` text,
	`entities` text,
	`embedding` blob
);
--> statement-breakpoint
CREATE TABLE `questionsAnsweredEmbedding` (
	`id` text PRIMARY KEY,
	`integrationArtifactId` text NOT NULL,
	`integration` text NOT NULL,
	`updateDate` text NOT NULL,
	`artifactDate` text,
	`content` text,
	`entities` text,
	`embedding` blob
);
--> statement-breakpoint
CREATE TABLE `gongCall` (
	`id` text PRIMARY KEY,
	`callId` text NOT NULL,
	`url` text,
	`title` text,
	`scheduled` text,
	`started` text,
	`duration` text,
	`primaryUserId` text,
	`direction` text,
	`system` text,
	`scope` text,
	`media` text,
	`language` text,
	`workspaceId` text,
	`sdrDisposition` text,
	`clientUniqueId` text,
	`customData` text,
	`purpose` text,
	`meetingUrl` text,
	`isPrivate` text,
	`calendarEventId` text
);
--> statement-breakpoint
CREATE TABLE `gongTranscript` (
	`id` text PRIMARY KEY,
	`callId` text NOT NULL,
	`transcript` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gongCall_callId_unique_idx` ON `gongCall` (`callId`);--> statement-breakpoint
CREATE UNIQUE INDEX `gongTranscript_callId_unique_idx` ON `gongTranscript` (`callId`);