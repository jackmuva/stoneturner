ALTER TABLE `notionBlock` ADD `blockId` text NOT NULL;--> statement-breakpoint
ALTER TABLE `notionBlock` ADD `type` text NOT NULL;--> statement-breakpoint
ALTER TABLE `notionBlock` ADD `nextCursor` text;--> statement-breakpoint
ALTER TABLE `notionBlock` ADD `hasMore` integer;--> statement-breakpoint
ALTER TABLE `notionBlock` ADD `hasChildren` integer;--> statement-breakpoint
ALTER TABLE `notionBlock` ADD `childrenBlockIds` text;--> statement-breakpoint
ALTER TABLE `notionBlock` ADD `text` text;--> statement-breakpoint
ALTER TABLE `notionBlock` ADD `lastEditedTime` text;--> statement-breakpoint
CREATE UNIQUE INDEX `notionBlock_blockId_unique_idx` ON `notionBlock` (`blockId`);