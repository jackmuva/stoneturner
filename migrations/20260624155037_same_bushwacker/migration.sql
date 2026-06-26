CREATE TABLE `notionBlock` (
	`id` text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE `notionPage` (
	`id` text PRIMARY KEY,
	`pageId` text NOT NULL,
	`createdTime` text,
	`lastEditedTime` text,
	`createdBy` text,
	`lastEditedBy` text,
	`archived` integer,
	`inTrash` integer,
	`icon` text,
	`cover` text,
	`properties` text,
	`parent` text,
	`url` text,
	`publicUrl` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notionPage_pageId_unique_idx` ON `notionPage` (`pageId`);