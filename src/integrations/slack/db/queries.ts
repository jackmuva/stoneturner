import {
  slackTeam,
  slackChannel,
  slackUser,
  slackMessage,
  type SlackTeamInsert,
  type SlackTeamSelect,
  type SlackChannelInsert,
  type SlackChannelSelect,
  type SlackUserInsert,
  type SlackUserSelect,
  type SlackMessageInsert,
  type SlackMessageSelect,
} from "./schema";
import { and, asc, desc, eq, lte, gte, or, sql } from "drizzle-orm";
import { PAGE_SIZE } from "@/lib/constants";
import type { SqliteDb } from "@/core/models/db-models";

export const batchInsertSlackTeam = async (teams: SlackTeamInsert[], db: SqliteDb): Promise<void> => {
  await db.insert(slackTeam)
    .values(teams)
    .onConflictDoUpdate({
      target: slackTeam.id,
      set: {
        name: sql`excluded.name`,
        domain: sql`excluded.domain`,
        enterpriseId: sql`excluded.enterpriseId`,
        isEnterpriseInstall: sql`excluded.isEnterpriseInstall`,
      },
    });
};

export const getSlackTeams = async (offset: number = 0, db: SqliteDb): Promise<SlackTeamSelect[]> => {
  return await db.select()
    .from(slackTeam)
    .limit(PAGE_SIZE)
    .offset(offset);
};

export const batchInsertSlackChannel = async (channels: SlackChannelInsert[], db: SqliteDb): Promise<void> => {
  await db.insert(slackChannel)
    .values(channels)
    .onConflictDoUpdate({
      target: slackChannel.id,
      set: {
        teamId: sql`excluded.teamId`,
        name: sql`excluded.name`,
        topic: sql`excluded.topic`,
        purpose: sql`excluded.purpose`,
        numMembers: sql`excluded.numMembers`,
        isArchived: sql`excluded.isArchived`,
        created: sql`excluded.created`,
      },
    });
};

export const getSlackChannels = async (offset: number = 0, db: SqliteDb): Promise<SlackChannelSelect[]> => {
  return await db.select()
    .from(slackChannel)
    .limit(PAGE_SIZE)
    .offset(offset);
};

export const getSlackChannelById = async (id: string, db: SqliteDb): Promise<SlackChannelSelect | null> => {
  const [returning] = await db.select().from(slackChannel).where(eq(slackChannel.id, id));
  return returning ?? null;
};

export const batchInsertSlackUser = async (users: SlackUserInsert[], db: SqliteDb): Promise<void> => {
  await db.insert(slackUser)
    .values(users)
    .onConflictDoUpdate({
      target: slackUser.id,
      set: {
        teamId: sql`excluded.teamId`,
        name: sql`excluded.name`,
        realName: sql`excluded.realName`,
        displayName: sql`excluded.displayName`,
        isBot: sql`excluded.isBot`,
        deleted: sql`excluded.deleted`,
      },
    });
};

export const getSlackUserById = async (id: string, db: SqliteDb): Promise<SlackUserSelect | null> => {
  const [returning] = await db.select().from(slackUser).where(eq(slackUser.id, id));
  return returning ?? null;
};

export const batchInsertSlackMessage = async (messages: SlackMessageInsert[], db: SqliteDb): Promise<void> => {
  if (messages.length === 0) return;
  await db.insert(slackMessage)
    .values(messages)
    .onConflictDoUpdate({
      target: slackMessage.id,
      set: {
        channelId: sql`excluded.channelId`,
        ts: sql`excluded.ts`,
        userId: sql`excluded.userId`,
        text: sql`excluded.text`,
        threadTs: sql`excluded.threadTs`,
        isReply: sql`excluded.isReply`,
        replyCount: sql`excluded.replyCount`,
        latestReply: sql`excluded.latestReply`,
        subtype: sql`excluded.subtype`,
        editedTs: sql`excluded.editedTs`,
        reactions: sql`excluded.reactions`,
        attachments: sql`excluded.attachments`,
        blocks: sql`excluded.blocks`,
        botId: sql`excluded.botId`,
      },
    });
};

export const getLastMessageByChannelId = async (channelId: string, db: SqliteDb): Promise<SlackMessageSelect | null> => {
  const [returning] = await db.select().from(slackMessage)
    .where(eq(slackMessage.channelId, channelId))
    .orderBy(desc(slackMessage.ts))
    .limit(1);
  return returning ?? null;
};

export const getMessageTimestampRangeByChannelId = async (
  channelId: string,
  db: SqliteDb,
): Promise<{ minMessageTimestamp: string; maxMessageTimestamp: string } | undefined> => {
  const [record] = await db.select({
    minMessageTimestamp: sql<string>`MIN(${slackMessage.ts})`,
    maxMessageTimestamp: sql<string>`MAX(${slackMessage.ts})`,
  }).from(slackMessage)
    .where(and(eq(slackMessage.channelId, channelId), eq(slackMessage.isReply, false)));
  return record;
};

export const getTopLevelMessagesByChannelId = async (
  channelId: string,
  beforeTs: string,
  afterTs: string,
  db: SqliteDb,
): Promise<SlackMessageSelect[]> => {
  return await db.select()
    .from(slackMessage)
    .where(and(
      eq(slackMessage.channelId, channelId),
      eq(slackMessage.isReply, false),
      lte(slackMessage.ts, beforeTs),
      gte(slackMessage.ts, afterTs),
    ))
    .orderBy(asc(slackMessage.ts));
};

export const getMessagesByThreadTs = async (
  channelId: string,
  threadTs: string,
  db: SqliteDb,
): Promise<SlackMessageSelect[]> => {
  return await db.select()
    .from(slackMessage)
    .where(and(
      eq(slackMessage.channelId, channelId),
      or(eq(slackMessage.threadTs, threadTs), eq(slackMessage.ts, threadTs)),
    ))
    .orderBy(asc(slackMessage.ts));
};

export const getSlackThreadParents = async (
  offset: number,
  db: SqliteDb,
): Promise<{ channelId: string; threadTs: string; latestReply: string | null }[]> => {
  const records = await db.select({
    channelId: slackMessage.channelId,
    threadTs: slackMessage.ts,
    latestReply: slackMessage.latestReply,
  }).from(slackMessage)
    .where(and(
      sql`${slackMessage.replyCount} > 0`,
      eq(slackMessage.isReply, false),
    ))
    .limit(PAGE_SIZE)
    .offset(offset);

  return records.map((r) => ({
    channelId: r.channelId,
    threadTs: r.threadTs,
    latestReply: r.latestReply,
  }));
};

export const getLastReplyTsByThread = async (
  channelId: string,
  threadTs: string,
  db: SqliteDb,
): Promise<string | null> => {
  const [record] = await db.select({ ts: slackMessage.ts })
    .from(slackMessage)
    .where(and(
      eq(slackMessage.channelId, channelId),
      eq(slackMessage.isReply, true),
      eq(slackMessage.threadTs, threadTs),
    ))
    .orderBy(desc(slackMessage.ts))
    .limit(1);
  return record?.ts ?? null;
};

export const deleteAllSlackData = async (db: SqliteDb): Promise<void> => {
  await db.delete(slackMessage);
  await db.delete(slackUser);
  await db.delete(slackChannel);
  await db.delete(slackTeam);
};
