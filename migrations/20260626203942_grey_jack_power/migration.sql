CREATE TABLE `notionPageMarkdown` (
	`id` text PRIMARY KEY,
	`pageId` text NOT NULL,
	`object` text,
	`markdown` text,
	`truncated` integer,
	`unknownBlockIds` text,
	`lastEditedTime` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notionPageMarkdown_pageId_unique_idx` ON `notionPageMarkdown` (`pageId`);