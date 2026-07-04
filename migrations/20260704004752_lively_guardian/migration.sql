CREATE TABLE `twitterTweet` (
	`id` text PRIMARY KEY,
	`tweetId` text NOT NULL,
	`source` text NOT NULL,
	`text` text NOT NULL,
	`authorId` text,
	`authorUsername` text,
	`authorName` text,
	`createdAt` text,
	`conversationId` text,
	`inReplyToUserId` text,
	`lang` text,
	`publicMetrics` text,
	`entities` text,
	`referencedTweets` text,
	`url` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `twitterTweet_tweetId_unique_idx` ON `twitterTweet` (`tweetId`);