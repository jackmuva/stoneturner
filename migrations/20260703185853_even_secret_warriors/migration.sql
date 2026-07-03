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
CREATE UNIQUE INDEX `githubDiscussion_artifactId_unique_idx` ON `githubDiscussion` (`artifactId`);--> statement-breakpoint
CREATE UNIQUE INDEX `githubDoc_artifactId_unique_idx` ON `githubDoc` (`artifactId`);--> statement-breakpoint
CREATE UNIQUE INDEX `githubIssue_artifactId_unique_idx` ON `githubIssue` (`artifactId`);--> statement-breakpoint
CREATE UNIQUE INDEX `githubPull_artifactId_unique_idx` ON `githubPull` (`artifactId`);--> statement-breakpoint
CREATE UNIQUE INDEX `githubSourceFile_artifactId_unique_idx` ON `githubSourceFile` (`artifactId`);