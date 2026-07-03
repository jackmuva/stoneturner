CREATE TABLE `linearDocument` (
	`id` text PRIMARY KEY,
	`artifactId` text NOT NULL,
	`documentId` text NOT NULL,
	`title` text,
	`content` text,
	`url` text,
	`projectName` text,
	`issueIdentifier` text,
	`issueTitle` text,
	`creator` text,
	`updatedBy` text,
	`comments` text,
	`createdAt` text,
	`updatedAt` text
);
--> statement-breakpoint
CREATE TABLE `linearIssue` (
	`id` text PRIMARY KEY,
	`artifactId` text NOT NULL,
	`issueId` text NOT NULL,
	`teamKey` text NOT NULL,
	`identifier` text NOT NULL,
	`title` text,
	`description` text,
	`state` text,
	`stateType` text,
	`priority` integer,
	`estimate` integer,
	`assignee` text,
	`creator` text,
	`labels` text,
	`comments` text,
	`projectName` text,
	`cycleName` text,
	`dueDate` text,
	`url` text,
	`createdAt` text,
	`updatedAt` text
);
--> statement-breakpoint
CREATE TABLE `linearProject` (
	`id` text PRIMARY KEY,
	`artifactId` text NOT NULL,
	`projectId` text NOT NULL,
	`name` text,
	`description` text,
	`state` text,
	`progress` text,
	`startDate` text,
	`targetDate` text,
	`lead` text,
	`teamKeys` text,
	`updates` text,
	`url` text,
	`createdAt` text,
	`updatedAt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `linearDocument_artifactId_unique_idx` ON `linearDocument` (`artifactId`);--> statement-breakpoint
CREATE UNIQUE INDEX `linearDocument_documentId_unique_idx` ON `linearDocument` (`documentId`);--> statement-breakpoint
CREATE UNIQUE INDEX `linearIssue_artifactId_unique_idx` ON `linearIssue` (`artifactId`);--> statement-breakpoint
CREATE UNIQUE INDEX `linearIssue_issueId_unique_idx` ON `linearIssue` (`issueId`);--> statement-breakpoint
CREATE UNIQUE INDEX `linearProject_artifactId_unique_idx` ON `linearProject` (`artifactId`);--> statement-breakpoint
CREATE UNIQUE INDEX `linearProject_projectId_unique_idx` ON `linearProject` (`projectId`);