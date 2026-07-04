CREATE TABLE `googleCalendar` (
	`id` text PRIMARY KEY,
	`calendarId` text NOT NULL,
	`summary` text,
	`description` text,
	`timeZone` text,
	`accessRole` text
);
--> statement-breakpoint
CREATE TABLE `googleCalendarEvent` (
	`id` text PRIMARY KEY,
	`eventId` text NOT NULL,
	`calendarId` text NOT NULL,
	`status` text,
	`htmlLink` text,
	`created` text,
	`updated` text,
	`summary` text,
	`description` text,
	`location` text,
	`start` text,
	`end` text,
	`organizer` text,
	`attendees` text,
	`hangoutLink` text,
	`conferenceData` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `googleCalendar_calendarId_unique_idx` ON `googleCalendar` (`calendarId`);--> statement-breakpoint
CREATE UNIQUE INDEX `googleCalendarEvent_calendarId_eventId_unique_idx` ON `googleCalendarEvent` (`calendarId`,`eventId`);