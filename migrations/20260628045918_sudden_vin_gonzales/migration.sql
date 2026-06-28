CREATE TABLE `firecrawlPage` (
	`id` text PRIMARY KEY,
	`url` text NOT NULL,
	`sourceUrl` text,
	`title` text,
	`markdown` text,
	`html` text,
	`crawledAt` text
);
--> statement-breakpoint
ALTER TABLE `integrationCredential` ADD `options` text;--> statement-breakpoint
CREATE UNIQUE INDEX `firecrawlPage_url_unique_idx` ON `firecrawlPage` (`url`);