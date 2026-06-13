import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { GongSentence } from "../models/models";

export const gongTranscript = sqliteTable("gongTranscript", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  callId: text("callId").unique().notNull(),
  transcript: text("transcript", { mode: "json" }).$type<GongSentence[]>(),
},
  (table) => [
    uniqueIndex("gongTranscript_callId_unique_idx").on(table.callId),
  ]);

export type GongTranscriptSelect = InferSelectModel<typeof gongTranscript>;
export type GongTranscriptInsert = InferInsertModel<typeof gongTranscript>;

export const gongCall = sqliteTable("gongCall", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  callId: text("callId").unique().notNull(),
  url: text("url"),
  title: text("title"),
  scheduled: text("scheduled"),
  started: text("started"),
  duration: text("duration"),
  primaryUserId: text("primaryUserId"),
  direction: text("direction"),
  system: text("system"),
  scope: text("scope"),
  media: text("media"),
  language: text("language"),
  workspaceId: text("workspaceId"),
  sdrDisposition: text("sdrDisposition"),
  clientUniqueId: text("clientUniqueId"),
  customData: text("customData"),
  purpose: text("purpose"),
  meetingUrl: text("meetingUrl"),
  isPrivate: text("isPrivate").$type<boolean>(),
  calendarEventId: text("calendarEventId"),
},
  (table) => [
    uniqueIndex("gongCall_callId_unique_idx").on(table.callId),
  ]);

export type GongCallSelect = InferSelectModel<typeof gongCall>;
export type GongCallInsert = InferInsertModel<typeof gongCall>;

