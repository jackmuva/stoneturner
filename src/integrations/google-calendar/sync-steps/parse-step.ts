import { getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { PAGE_SIZE, SUMMARIZATION_MODEL } from "@/lib/constants";
import { generateText, Output } from "ai";
import * as z from "zod";
import { aiGatewayBottleneck } from "@/core/services/rate-limiter";
import { getGoogleCalendarByCalendarId, getGoogleCalendarEvents } from "../db/queries";
import type { GoogleCalendarEventSelect } from "../db/schema";
import type { GoogleEventDateTime } from "../models/models";
import type { SqliteDb } from "@/core/models/db-models";

export const parseGoogleCalendarStep = async (db: SqliteDb, cursor?: number): Promise<void> => {
  let curOffset: number = cursor ?? 0;
  let events: GoogleCalendarEventSelect[] = [];
  let firstIteration = true;

  while (events.length > 0 || firstIteration) {
    firstIteration = false;
    try {
      events = await getGoogleCalendarEvents(curOffset, db);
      const results = await Promise.allSettled(
        events.map((event) => aiGatewayBottleneck.schedule(() => generateMdArtifact(event, db))),
      );
      const failures = results
        .filter((r) => r.status === "rejected")
        .map((r) => String((r as PromiseRejectedResult).reason));

      await upsertSyncTask({
        integration: "google-calendar",
        status: failures.length ? "FAILED" : "SUCCESS",
        inputs: failures.length
          ? { cursor: curOffset, errors: failures }
          : { cursor: curOffset },
        step: "parse",
      }, db);
    } catch (e) {
      await upsertSyncTask({
        integration: "google-calendar",
        status: "FAILED",
        inputs: { cursor: curOffset, error: String(e) },
        step: "parse",
      }, db);
    }

    if (cursor !== undefined) break;
    curOffset += PAGE_SIZE;
  }
};

const formatDateTime = (dt?: GoogleEventDateTime): string => {
  if (!dt) return "Unknown";
  if (dt.dateTime) return dt.dateTime;
  if (dt.date) return dt.date;
  return "Unknown";
};

const generateMdArtifact = async (event: GoogleCalendarEventSelect, db: SqliteDb): Promise<void> => {
  const calendar = await getGoogleCalendarByCalendarId(event.calendarId, db);
  const artifactId = `${event.calendarId}:${event.eventId}`;

  const md: string[] = [];
  md.push(`# ${event.summary ?? "Untitled Event"}\n\n`);
  md.push(`**Calendar:** ${calendar?.summary ?? event.calendarId}\n\n`);
  md.push(`**Start:** ${formatDateTime(event.start ?? undefined)}\n\n`);
  md.push(`**End:** ${formatDateTime(event.end ?? undefined)}\n\n`);

  if (event.location) md.push(`**Location:** ${event.location}\n\n`);
  if (event.htmlLink) md.push(`**Link:** ${event.htmlLink}\n\n`);
  if (event.hangoutLink) md.push(`**Meeting:** ${event.hangoutLink}\n\n`);

  const videoLinks = event.conferenceData?.entryPoints
    ?.filter((ep) => ep.uri)
    .map((ep) => ep.uri!) ?? [];
  for (const link of videoLinks) {
    if (link !== event.hangoutLink) md.push(`**Conference:** ${link}\n\n`);
  }

  if (event.organizer) {
    const name = event.organizer.displayName ?? event.organizer.email ?? "Unknown";
    md.push(`**Organizer:** ${name}\n\n`);
  }

  if (event.attendees && event.attendees.length > 0) {
    md.push("**Attendees:**\n\n");
    for (const attendee of event.attendees) {
      const name = attendee.displayName ?? attendee.email ?? "Unknown";
      const status = attendee.responseStatus ? ` (${attendee.responseStatus})` : "";
      md.push(`- ${name}${status}\n`);
    }
    md.push("\n");
  }

  if (event.description) {
    md.push(`## Description\n\n${event.description}\n\n`);
  }

  const markdown = md.join("");
  const existing = await getMdArtifactByIntegrationArtifactId(artifactId, db);
  if (existing && existing.markdown === markdown) return;

  const { output: analysis } = await retry(async () => await generateText({
    model: SUMMARIZATION_MODEL,
    prompt: `Analyze the following calendar event and extract three distinct types of information:

1. KEY POINTS: The main takeaways, important concepts, and key ideas from this event.
2. QUESTIONS ANSWERED: The key questions or problems this event addresses or resolves.
3. ENTITIES: Names of people, companies, tools, products, concepts, and other important entities mentioned.

For each category, provide a comprehensive list with clear, concise entries.

Event:
${markdown}`,
    output: Output.object({
      schema: z.object({
        keyPoints: z.array(z.string()),
        questionsAnswered: z.array(z.string()),
        entities: z.array(z.string()),
      }),
    }),
  }), 3, 1);

  await upsertMdArtifact({
    integrationArtifactId: artifactId,
    integration: "google-calendar",
    artifactDate: event.start?.dateTime ?? event.start?.date ?? event.updated ?? undefined,
    markdown,
    keyPoints: analysis.keyPoints,
    questionsAnswered: analysis.questionsAnswered,
    entities: analysis.entities,
  }, db);
};
