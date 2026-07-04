import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const gmailMessage = sqliteTable("gmailMessage", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  messageId: text("messageId").unique().notNull(),
  threadId: text("threadId"),
  subject: text("subject"),
  fromAddress: text("fromAddress"),
  toAddress: text("toAddress"),
  ccAddress: text("ccAddress"),
  dateHeader: text("dateHeader"),
  internalDate: text("internalDate"),
  snippet: text("snippet"),
  bodyText: text("bodyText"),
  labelIds: text("labelIds", { mode: "json" }).$type<string[]>(),
  historyId: text("historyId"),
},
  (table) => [
    uniqueIndex("gmailMessage_messageId_unique_idx").on(table.messageId),
  ]);

export type GmailMessageSelect = InferSelectModel<typeof gmailMessage>;
export type GmailMessageInsert = InferInsertModel<typeof gmailMessage>;
