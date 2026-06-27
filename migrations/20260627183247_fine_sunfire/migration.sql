CREATE TABLE `plaudFile` (
	`id` text PRIMARY KEY,
	`fileId` text NOT NULL,
	`name` text,
	`createdAt` text,
	`serialNumber` text,
	`startAt` text,
	`duration` integer
);
--> statement-breakpoint
CREATE TABLE `plaudTranscript` (
	`id` text PRIMARY KEY,
	`fileId` text NOT NULL,
	`name` text,
	`segments` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plaudFile_fileId_unique_idx` ON `plaudFile` (`fileId`);--> statement-breakpoint
CREATE UNIQUE INDEX `plaudTranscript_fileId_unique_idx` ON `plaudTranscript` (`fileId`);