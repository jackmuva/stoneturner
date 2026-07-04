CREATE TABLE `gmailMessage` (
	`id` text PRIMARY KEY,
	`messageId` text NOT NULL,
	`threadId` text,
	`subject` text,
	`fromAddress` text,
	`toAddress` text,
	`ccAddress` text,
	`dateHeader` text,
	`internalDate` text,
	`snippet` text,
	`bodyText` text,
	`labelIds` text,
	`historyId` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gmailMessage_messageId_unique_idx` ON `gmailMessage` (`messageId`);