import { desc, eq, sql } from "drizzle-orm";
import { PAGE_SIZE } from "@/lib/constants";
import type { SqliteDb } from "@/core/models/db-models";
import {
  gmailMessage,
  type GmailMessageInsert,
  type GmailMessageSelect,
} from "./schema";

export const batchInsertGmailMessage = async (messages: GmailMessageInsert[], db: SqliteDb): Promise<void> => {
  if (messages.length === 0) return;
  await db.insert(gmailMessage)
    .values(messages)
    .onConflictDoUpdate({
      target: gmailMessage.messageId,
      set: {
        threadId: sql`excluded.threadId`,
        subject: sql`excluded.subject`,
        fromAddress: sql`excluded.fromAddress`,
        toAddress: sql`excluded.toAddress`,
        ccAddress: sql`excluded.ccAddress`,
        dateHeader: sql`excluded.dateHeader`,
        internalDate: sql`excluded.internalDate`,
        snippet: sql`excluded.snippet`,
        bodyText: sql`excluded.bodyText`,
        labelIds: sql`excluded.labelIds`,
        historyId: sql`excluded.historyId`,
      },
    });
};

export const getGmailMessages = async (offset: number = 0, db: SqliteDb): Promise<GmailMessageSelect[]> => {
  return await db.select()
    .from(gmailMessage)
    .limit(PAGE_SIZE)
    .offset(offset);
};

export const getGmailMessageByMessageId = async (messageId: string, db: SqliteDb): Promise<GmailMessageSelect | undefined> => {
  const [result] = await db.select().from(gmailMessage).where(eq(gmailMessage.messageId, messageId));
  return result;
};

export const getLatestGmailMessage = async (db: SqliteDb): Promise<GmailMessageSelect | null> => {
  const [message] = await db.select()
    .from(gmailMessage)
    .orderBy(desc(gmailMessage.internalDate))
    .limit(1);
  return message ?? null;
};

export const deleteGmailData = async (db: SqliteDb): Promise<void> => {
  await db.delete(gmailMessage);
};
