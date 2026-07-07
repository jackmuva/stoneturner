CREATE TABLE `SyncSchedule` (
	`integration` text PRIMARY KEY,
	`frequency` text NOT NULL,
	`updateDate` text NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_syncTask` (
	`id` text PRIMARY KEY,
	`integration` text NOT NULL,
	`updateDate` text NOT NULL,
	`status` text,
	`inputs` text,
	`error` text,
	`step` text,
	`retries` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_syncTask`(`id`, `integration`, `updateDate`, `status`, `inputs`, `error`, `step`, `retries`) SELECT `id`, `integration`, `updateDate`, `status`, `inputs`, `error`, `step`, `retries` FROM `syncTask`;--> statement-breakpoint
DROP TABLE `syncTask`;--> statement-breakpoint
ALTER TABLE `__new_syncTask` RENAME TO `syncTask`;--> statement-breakpoint
PRAGMA foreign_keys=ON;