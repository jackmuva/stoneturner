import { desc, eq, sql } from "drizzle-orm";
import { PAGE_SIZE } from "@/lib/constants";
import type { SqliteDb } from "@/core/models/db-models";
import { twitterTweet, type TwitterTweetInsert, type TwitterTweetSelect } from "./schema";
import type { TwitterTweetSource } from "../models/models";

export const batchInsertTwitterTweet = async (tweets: TwitterTweetInsert[], db: SqliteDb): Promise<void> => {
  if (tweets.length === 0) return;
  await db.insert(twitterTweet)
    .values(tweets)
    .onConflictDoUpdate({
      target: twitterTweet.tweetId,
      set: {
        source: sql`excluded.source`,
        text: sql`excluded.text`,
        authorId: sql`excluded.authorId`,
        authorUsername: sql`excluded.authorUsername`,
        authorName: sql`excluded.authorName`,
        createdAt: sql`excluded.createdAt`,
        conversationId: sql`excluded.conversationId`,
        inReplyToUserId: sql`excluded.inReplyToUserId`,
        lang: sql`excluded.lang`,
        publicMetrics: sql`excluded.publicMetrics`,
        entities: sql`excluded.entities`,
        referencedTweets: sql`excluded.referencedTweets`,
        url: sql`excluded.url`,
      },
    });
};

export const getTwitterTweets = async (offset: number = 0, db: SqliteDb): Promise<TwitterTweetSelect[]> => {
  return await db.select()
    .from(twitterTweet)
    .orderBy(desc(twitterTweet.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);
};

export const getLatestTwitterTweetId = async (
  source: TwitterTweetSource,
  db: SqliteDb,
): Promise<string | null> => {
  const [row] = await db.select({ tweetId: twitterTweet.tweetId })
    .from(twitterTweet)
    .where(eq(twitterTweet.source, source))
    .orderBy(desc(twitterTweet.tweetId))
    .limit(1);
  return row?.tweetId ?? null;
};

export const deleteTwitterData = async (db: SqliteDb): Promise<void> => {
  await db.delete(twitterTweet);
};
