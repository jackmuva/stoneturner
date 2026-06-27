import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { PlaudTranscriptSegment } from "../models/models";

export const plaudFile = sqliteTable("plaudFile", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  fileId: text("fileId").unique().notNull(),
  name: text("name"),
  createdAt: text("createdAt"),
  serialNumber: text("serialNumber"),
  startAt: text("startAt"),
  duration: integer("duration"),
},
  (table) => [
    uniqueIndex("plaudFile_fileId_unique_idx").on(table.fileId),
  ]);

export type PlaudFileSelect = InferSelectModel<typeof plaudFile>;
export type PlaudFileInsert = InferInsertModel<typeof plaudFile>;

export const plaudTranscript = sqliteTable("plaudTranscript", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  fileId: text("fileId").unique().notNull(),
  name: text("name"),
  segments: text("segments", { mode: "json" }).$type<PlaudTranscriptSegment[]>(),
},
  (table) => [
    uniqueIndex("plaudTranscript_fileId_unique_idx").on(table.fileId),
  ]);

export type PlaudTranscriptSelect = InferSelectModel<typeof plaudTranscript>;
export type PlaudTranscriptInsert = InferInsertModel<typeof plaudTranscript>;
