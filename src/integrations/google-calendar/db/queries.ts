import {
  googleCalendar, type GoogleCalendarInsert, type GoogleCalendarSelect,
  googleCalendarEvent, type GoogleCalendarEventInsert, type GoogleCalendarEventSelect,
} from "./schema";
import { desc, eq, sql } from "drizzle-orm";
import { PAGE_SIZE } from "@/lib/constants";
import type { SqliteDb } from "@/core/models/db-models";

export const batchInsertGoogleCalendar = async (calendars: GoogleCalendarInsert[], db: SqliteDb): Promise<void> => {
  if (calendars.length === 0) return;
  await db.insert(googleCalendar)
    .values(calendars)
    .onConflictDoUpdate({
      target: googleCalendar.calendarId,
      set: {
        summary: sql`excluded.summary`,
        description: sql`excluded.description`,
        timeZone: sql`excluded.timeZone`,
        accessRole: sql`excluded.accessRole`,
      },
    });
};

export const getGoogleCalendars = async (db: SqliteDb): Promise<GoogleCalendarSelect[]> => {
  return await db.select().from(googleCalendar);
};

export const batchInsertGoogleCalendarEvent = async (events: GoogleCalendarEventInsert[], db: SqliteDb): Promise<void> => {
  if (events.length === 0) return;
  await db.insert(googleCalendarEvent)
    .values(events)
    .onConflictDoUpdate({
      target: [googleCalendarEvent.calendarId, googleCalendarEvent.eventId],
      set: {
        status: sql`excluded.status`,
        htmlLink: sql`excluded.htmlLink`,
        created: sql`excluded.created`,
        updated: sql`excluded.updated`,
        summary: sql`excluded.summary`,
        description: sql`excluded.description`,
        location: sql`excluded.location`,
        start: sql`excluded.start`,
        end: sql`excluded.end`,
        organizer: sql`excluded.organizer`,
        attendees: sql`excluded.attendees`,
        hangoutLink: sql`excluded.hangoutLink`,
        conferenceData: sql`excluded.conferenceData`,
      },
    });
};

export const getLatestGoogleCalendarEventUpdated = async (db: SqliteDb): Promise<string | null> => {
  const [event] = await db.select()
    .from(googleCalendarEvent)
    .orderBy(desc(googleCalendarEvent.updated))
    .limit(1);
  return event?.updated ?? null;
};

export const getGoogleCalendarEvents = async (offset: number = 0, db: SqliteDb): Promise<GoogleCalendarEventSelect[]> => {
  return await db.select()
    .from(googleCalendarEvent)
    .limit(PAGE_SIZE)
    .offset(offset);
};

export const getGoogleCalendarByCalendarId = async (calendarId: string, db: SqliteDb): Promise<GoogleCalendarSelect | undefined> => {
  const [result] = await db.select().from(googleCalendar).where(eq(googleCalendar.calendarId, calendarId));
  return result;
};

export const deleteGoogleCalendarData = async (db: SqliteDb): Promise<void> => {
  await db.delete(googleCalendarEvent);
  await db.delete(googleCalendar);
};
