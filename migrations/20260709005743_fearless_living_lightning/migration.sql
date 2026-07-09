ALTER TABLE `SyncSchedule` RENAME TO `syncPipeline`;--> statement-breakpoint
ALTER TABLE `syncPipeline` ADD `status` text DEFAULT 'IDLE' NOT NULL;