import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { batchInsertGoogleCalendar } from "../db/queries";
import type { GoogleCalendarInsert } from "../db/schema";
import type { GoogleCalendarListResponse } from "../models/models";
import { GOOGLE_CALENDAR_BASE_API, googleCalendarFetch } from "./google-calendar-utils";
import type { SqliteDb } from "@/core/models/db-models";

export const syncGoogleCalendarsStep = async (_incremental: boolean = false, db: SqliteDb, cursor?: string): Promise<void> => {
  let nextCursor: string | undefined = cursor;

  while (true) {
    let response: GoogleCalendarListResponse | null = null;
    try {
      response = await retry(async () => await fetchCalendarPage(nextCursor, db), 3, 1);
    } catch (e) {
      await upsertSyncTask({
        integration: "google-calendar",
        status: "FAILED",
        step: "google-calendar-sync-calendars",
        inputs: { cursor: nextCursor ?? null, error: String(e) },
      }, db);
      break;
    }

    try {
      const items = response.items ?? [];
      const rows: GoogleCalendarInsert[] = items.map((cal) => ({
        calendarId: cal.id,
        summary: cal.summary,
        description: cal.description,
        timeZone: cal.timeZone,
        accessRole: cal.accessRole,
      }));

      await batchInsertGoogleCalendar(rows, db);

      if (!response.nextPageToken) {
        await upsertSyncTask({
          integration: "google-calendar",
          status: "SUCCESS",
          step: "google-calendar-sync-calendars",
          inputs: { cursor: null, count: rows.length },
        }, db);
        break;
      }

      nextCursor = response.nextPageToken;
      await upsertSyncTask({
        integration: "google-calendar",
        status: "SUCCESS",
        step: "google-calendar-sync-calendars",
        inputs: { cursor: nextCursor, count: rows.length },
      }, db);

      if (cursor !== undefined) break;
    } catch (e) {
      await upsertSyncTask({
        integration: "google-calendar",
        status: "FAILED",
        step: "google-calendar-sync-calendars",
        inputs: { cursor: nextCursor ?? null, error: String(e) },
      }, db);
      break;
    }
  }
};

const fetchCalendarPage = async (pageToken: string | undefined, db: SqliteDb): Promise<GoogleCalendarListResponse> => {
  const url = new URL(`${GOOGLE_CALENDAR_BASE_API}/users/me/calendarList`);
  url.searchParams.set("maxResults", "250");
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const res = await googleCalendarFetch(url, db);
  return await res.json() as GoogleCalendarListResponse;
};
