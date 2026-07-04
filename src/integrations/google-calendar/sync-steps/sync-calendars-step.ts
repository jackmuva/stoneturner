import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { batchInsertGoogleCalendar } from "../db/queries";
import type { GoogleCalendarInsert } from "../db/schema";
import type { GoogleCalendarListResponse } from "../models/models";
import { GOOGLE_CALENDAR_BASE_API, googleCalendarFetch } from "./google-calendar-utils";
import type { SqliteDb } from "@/core/models/db-models";

export const syncGoogleCalendarsStep = async (_incremental: boolean = false, db: SqliteDb): Promise<void> => {
  let pageToken: string | undefined;

  do {
    try {
      const response = await retry(async () => await fetchCalendarPage(pageToken, db), 3, 1);
      const items = response.items ?? [];

      const rows: GoogleCalendarInsert[] = items.map((cal) => ({
        calendarId: cal.id,
        summary: cal.summary,
        description: cal.description,
        timeZone: cal.timeZone,
        accessRole: cal.accessRole,
      }));

      await batchInsertGoogleCalendar(rows, db);
      await upsertSyncTask({
        integration: "google-calendar",
        status: "SUCCESS",
        step: "google-calendar-sync-calendars",
        inputs: { pageToken: pageToken ?? null, count: rows.length },
      }, db);

      pageToken = response.nextPageToken;
    } catch (e) {
      await upsertSyncTask({
        integration: "google-calendar",
        status: "FAILED",
        step: "google-calendar-sync-calendars",
        inputs: { pageToken: pageToken ?? null, error: String(e) },
      }, db);
      break;
    }
  } while (pageToken);
};

const fetchCalendarPage = async (pageToken: string | undefined, db: SqliteDb): Promise<GoogleCalendarListResponse> => {
  const url = new URL(`${GOOGLE_CALENDAR_BASE_API}/users/me/calendarList`);
  url.searchParams.set("maxResults", "250");
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const res = await googleCalendarFetch(url, db);
  return await res.json() as GoogleCalendarListResponse;
};
