PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_syncPipeline` (
	`integration` text PRIMARY KEY,
	`frequency` text DEFAULT 'NO_SCHEDULE' NOT NULL,
	`updateDate` text NOT NULL,
	`status` text DEFAULT 'IDLE' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_syncPipeline`(`integration`, `frequency`, `updateDate`, `status`) SELECT `integration`, `frequency`, `updateDate`, `status` FROM `syncPipeline`;--> statement-breakpoint
DROP TABLE `syncPipeline`;--> statement-breakpoint
ALTER TABLE `__new_syncPipeline` RENAME TO `syncPipeline`;--> statement-breakpoint
PRAGMA foreign_keys=ON;