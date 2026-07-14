CREATE TABLE `linearIssue` (
	`id` text PRIMARY KEY,
	`issueId` text NOT NULL,
	`artifactId` text NOT NULL,
	`identifier` text NOT NULL,
	`title` text,
	`description` text,
	`priority` integer,
	`estimate` real,
	`stateName` text,
	`stateType` text,
	`teamId` text,
	`teamKey` text,
	`teamName` text,
	`assignee` text,
	`labels` text,
	`projectId` text,
	`projectName` text,
	`comments` text,
	`url` text,
	`createdAt` text,
	`updatedAt` text
);
--> statement-breakpoint
CREATE TABLE `linearProject` (
	`id` text PRIMARY KEY,
	`projectId` text NOT NULL,
	`artifactId` text NOT NULL,
	`name` text,
	`description` text,
	`state` text,
	`progress` real,
	`teamKeys` text,
	`teamNames` text,
	`lead` text,
	`url` text,
	`startDate` text,
	`targetDate` text,
	`createdAt` text,
	`updatedAt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `linearIssue_issueId_unique_idx` ON `linearIssue` (`issueId`);--> statement-breakpoint
CREATE UNIQUE INDEX `linearIssue_artifactId_unique_idx` ON `linearIssue` (`artifactId`);--> statement-breakpoint
CREATE UNIQUE INDEX `linearProject_projectId_unique_idx` ON `linearProject` (`projectId`);--> statement-breakpoint
CREATE UNIQUE INDEX `linearProject_artifactId_unique_idx` ON `linearProject` (`artifactId`);