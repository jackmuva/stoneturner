import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { batchInsertGoogleCalendarEvent, getGoogleCalendars, getLatestGoogleCalendarEventUpdated } from "../db/queries";
import type { GoogleCalendarEventInsert } from "../db/schema";
import type { GoogleCalendarEvent, GoogleEventsListResponse } from "../models/models";
import {
  GOOGLE_CALENDAR_BASE_API,
  calendarsFromCursor,
  googleCalendarFetch,
  twoYearsAgoIso,
  type GoogleCalendarEventsCursor,
} from "./google-calendar-utils";
import type { SqliteDb } from "@/core/models/db-models";

export const syncGoogleCalendarEventsStep = async (
  incremental: boolean = false,
  db: SqliteDb,
  cursor?: GoogleCalendarEventsCursor,
): Promise<void> => {
  let calendars = await getGoogleCalendars(db);
  if (calendars.length === 0) {
    await upsertSyncTask({
      integration: "google-calendar",
      status: "SUCCESS",
      step: "google-calendar-sync-events",
      inputs: { message: "no calendars to sync" },
    }, db);
    return;
  }

  calendars = calendarsFromCursor(calendars, cursor?.calendarId);

  let updatedMin: string | null = null;
  if (incremental) {
    updatedMin = await getLatestGoogleCalendarEventUpdated(db);
  }

  for (const calendar of calendars) {
    let pageToken: string | undefined =
      cursor?.calendarId === calendar.calendarId
        ? (cursor.pageToken ?? undefined)
        : undefined;

    do {
      const currentPageToken = pageToken ?? null;
      try {
        const response = await retry(
          async () => await fetchEventsPage(calendar.calendarId, pageToken, incremental, updatedMin, db),
          3,
          1,
        );

        const items = (response.items ?? []).filter((event) => event.status !== "cancelled");
        const rows: GoogleCalendarEventInsert[] = items.map((event) => eventToRow(calendar.calendarId, event));

        await batchInsertGoogleCalendarEvent(rows, db);

        const nextCursor: GoogleCalendarEventsCursor | null = response.nextPageToken
          ? { calendarId: calendar.calendarId, pageToken: response.nextPageToken }
          : null;

        await upsertSyncTask({
          integration: "google-calendar",
          status: "SUCCESS",
          step: "google-calendar-sync-events",
          inputs: nextCursor
            ? { calendarId: calendar.calendarId, count: rows.length, cursor: nextCursor }
            : { calendarId: calendar.calendarId, count: rows.length },
        }, db);

        pageToken = response.nextPageToken;
        if (cursor !== undefined) break;
      } catch (e) {
        await upsertSyncTask({
          integration: "google-calendar",
          status: "FAILED",
          step: "google-calendar-sync-events",
          inputs: {
            calendarId: calendar.calendarId,
            cursor: { calendarId: calendar.calendarId, pageToken: currentPageToken },
            error: String(e),
          },
        }, db);
        break;
      }
    } while (pageToken);

    if (cursor !== undefined) break;
  }
};

const eventToRow = (calendarId: string, event: GoogleCalendarEvent): GoogleCalendarEventInsert => ({
  eventId: event.id,
  calendarId,
  status: event.status,
  htmlLink: event.htmlLink,
  created: event.created,
  updated: event.updated,
  summary: event.summary,
  description: event.description,
  location: event.location,
  start: event.start,
  end: event.end,
  organizer: event.organizer,
  attendees: event.attendees,
  hangoutLink: event.hangoutLink,
  conferenceData: event.conferenceData,
});

const fetchEventsPage = async (
  calendarId: string,
  pageToken: string | undefined,
  incremental: boolean,
  updatedMin: string | null,
  db: SqliteDb,
): Promise<GoogleEventsListResponse> => {
  const url = new URL(`${GOOGLE_CALENDAR_BASE_API}/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");
  url.searchParams.set("showDeleted", "false");

  if (incremental && updatedMin) {
    url.searchParams.set("updatedMin", updatedMin);
  } else if (!incremental) {
    url.searchParams.set("timeMin", twoYearsAgoIso());
  }

  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const res = await googleCalendarFetch(url, db);
  return await res.json() as GoogleEventsListResponse;
};
