ALTER TABLE `discordGuild` ADD `iconHash` text;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `splash` text;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `discoverySplash` text;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `ownerId` text NOT NULL;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `region` text;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `afkChannelId` text;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `afkTimeout` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `widgetEnabled` integer;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `widgetChannelId` text;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `verificationLevel` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `defaultMessageNotifications` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `explicitContentFilter` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `roles` text NOT NULL;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `emojis` text NOT NULL;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `mfaLevel` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `applicationId` text;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `systemChannelId` text;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `systemChannelFlags` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `rulesChannelId` text;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `maxPresences` integer;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `maxMembers` integer;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `vanityUrlCode` text;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `description` text;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `premiumTier` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `premiumSubscriptionCount` integer;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `preferredLocale` text NOT NULL;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `publicUpdatesChannelId` text;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `maxVideoChannelUsers` integer;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `maxStageVideoChannelUsers` integer;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `welcomeScreen` text;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `nsfwLevel` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `stickers` text;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `premiumProgressBarEnabled` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `safetyAlertsChannelId` text;--> statement-breakpoint
ALTER TABLE `discordGuild` ADD `incidentsData` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_discordGuild` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`icon` text,
	`iconHash` text,
	`splash` text,
	`discoverySplash` text,
	`owner` integer,
	`ownerId` text NOT NULL,
	`permissions` text,
	`region` text,
	`afkChannelId` text,
	`afkTimeout` integer NOT NULL,
	`widgetEnabled` integer,
	`widgetChannelId` text,
	`verificationLevel` integer NOT NULL,
	`defaultMessageNotifications` integer NOT NULL,
	`explicitContentFilter` integer NOT NULL,
	`roles` text NOT NULL,
	`emojis` text NOT NULL,
	`features` text NOT NULL,
	`mfaLevel` integer NOT NULL,
	`applicationId` text,
	`systemChannelId` text,
	`systemChannelFlags` integer NOT NULL,
	`rulesChannelId` text,
	`maxPresences` integer,
	`maxMembers` integer,
	`vanityUrlCode` text,
	`description` text,
	`banner` text,
	`premiumTier` integer NOT NULL,
	`premiumSubscriptionCount` integer,
	`preferredLocale` text NOT NULL,
	`publicUpdatesChannelId` text,
	`maxVideoChannelUsers` integer,
	`maxStageVideoChannelUsers` integer,
	`approximateMemberCount` integer,
	`approximatePresenceCount` integer,
	`welcomeScreen` text,
	`nsfwLevel` integer NOT NULL,
	`stickers` text,
	`premiumProgressBarEnabled` integer NOT NULL,
	`safetyAlertsChannelId` text,
	`incidentsData` text
);
--> statement-breakpoint
INSERT INTO `__new_discordGuild`(`id`, `name`, `icon`, `banner`, `owner`, `permissions`, `features`, `approximateMemberCount`, `approximatePresenceCount`) SELECT `id`, `name`, `icon`, `banner`, `owner`, `permissions`, `features`, `approximateMemberCount`, `approximatePresenceCount` FROM `discordGuild`;--> statement-breakpoint
DROP TABLE `discordGuild`;--> statement-breakpoint
ALTER TABLE `__new_discordGuild` RENAME TO `discordGuild`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `discordGuild_id_unique_idx` ON `discordGuild` (`id`);