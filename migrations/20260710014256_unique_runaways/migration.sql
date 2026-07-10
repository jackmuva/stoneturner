CREATE TABLE `hubspotCompany` (
	`id` text PRIMARY KEY,
	`hubspotId` text NOT NULL,
	`name` text,
	`domain` text,
	`industry` text,
	`phone` text,
	`city` text,
	`state` text,
	`country` text,
	`properties` text,
	`createdAt` text,
	`updatedAt` text,
	`lastModifiedAt` text
);
--> statement-breakpoint
CREATE TABLE `hubspotContact` (
	`id` text PRIMARY KEY,
	`hubspotId` text NOT NULL,
	`email` text,
	`firstName` text,
	`lastName` text,
	`phone` text,
	`company` text,
	`jobTitle` text,
	`lifecycleStage` text,
	`properties` text,
	`createdAt` text,
	`updatedAt` text,
	`lastModifiedAt` text
);
--> statement-breakpoint
CREATE TABLE `hubspotDeal` (
	`id` text PRIMARY KEY,
	`hubspotId` text NOT NULL,
	`dealName` text,
	`amount` text,
	`dealStage` text,
	`pipeline` text,
	`closeDate` text,
	`properties` text,
	`createdAt` text,
	`updatedAt` text,
	`lastModifiedAt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hubspotCompany_hubspotId_unique_idx` ON `hubspotCompany` (`hubspotId`);--> statement-breakpoint
CREATE UNIQUE INDEX `hubspotContact_hubspotId_unique_idx` ON `hubspotContact` (`hubspotId`);--> statement-breakpoint
CREATE UNIQUE INDEX `hubspotDeal_hubspotId_unique_idx` ON `hubspotDeal` (`hubspotId`);