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
CREATE UNIQUE INDEX `slackChannel_id_unique_idx` ON `slackChannel` (`id`);--> statement-breakpoint
CREATE INDEX `slackChannel_teamId_idx` ON `slackChannel` (`teamId`);--> statement-breakpoint
CREATE UNIQUE INDEX `slackMessage_channelId_ts_unique_idx` ON `slackMessage` (`channelId`,`ts`);--> statement-breakpoint
CREATE INDEX `slackMessage_channelId_idx` ON `slackMessage` (`channelId`);--> statement-breakpoint
CREATE INDEX `slackMessage_threadTs_idx` ON `slackMessage` (`threadTs`);--> statement-breakpoint
CREATE UNIQUE INDEX `slackTeam_id_unique_idx` ON `slackTeam` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `slackUser_id_unique_idx` ON `slackUser` (`id`);--> statement-breakpoint
CREATE INDEX `slackUser_teamId_idx` ON `slackUser` (`teamId`);