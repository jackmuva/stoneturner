import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { GoogleConferenceData, GoogleEventDateTime, GoogleEventPerson } from "../models/models";

export const googleCalendar = sqliteTable("googleCalendar", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  calendarId: text("calendarId").unique().notNull(),
  summary: text("summary"),
  description: text("description"),
  timeZone: text("timeZone"),
  accessRole: text("accessRole"),
},
  (table) => [
    uniqueIndex("googleCalendar_calendarId_unique_idx").on(table.calendarId),
  ]);

export type GoogleCalendarSelect = InferSelectModel<typeof googleCalendar>;
export type GoogleCalendarInsert = InferInsertModel<typeof googleCalendar>;

export const googleCalendarEvent = sqliteTable("googleCalendarEvent", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventId: text("eventId").notNull(),
  calendarId: text("calendarId").notNull(),
  status: text("status"),
  htmlLink: text("htmlLink"),
  created: text("created"),
  updated: text("updated"),
  summary: text("summary"),
  description: text("description"),
  location: text("location"),
  start: text("start", { mode: "json" }).$type<GoogleEventDateTime>(),
  end: text("end", { mode: "json" }).$type<GoogleEventDateTime>(),
  organizer: text("organizer", { mode: "json" }).$type<GoogleEventPerson>(),
  attendees: text("attendees", { mode: "json" }).$type<GoogleEventPerson[]>(),
  hangoutLink: text("hangoutLink"),
  conferenceData: text("conferenceData", { mode: "json" }).$type<GoogleConferenceData>(),
},
  (table) => [
    uniqueIndex("googleCalendarEvent_calendarId_eventId_unique_idx").on(table.calendarId, table.eventId),
  ]);

export type GoogleCalendarEventSelect = InferSelectModel<typeof googleCalendarEvent>;
export type GoogleCalendarEventInsert = InferInsertModel<typeof googleCalendarEvent>;
