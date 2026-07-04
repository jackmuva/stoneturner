import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { TwitterEntities, TwitterPublicMetrics, TwitterReferencedTweet, TwitterTweetSource } from "../models/models";

export const twitterTweet = sqliteTable("twitterTweet", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tweetId: text("tweetId").unique().notNull(),
  source: text("source").$type<TwitterTweetSource>().notNull(),
  text: text("text").notNull(),
  authorId: text("authorId"),
  authorUsername: text("authorUsername"),
  authorName: text("authorName"),
  createdAt: text("createdAt"),
  conversationId: text("conversationId"),
  inReplyToUserId: text("inReplyToUserId"),
  lang: text("lang"),
  publicMetrics: text("publicMetrics", { mode: "json" }).$type<TwitterPublicMetrics>(),
  entities: text("entities", { mode: "json" }).$type<TwitterEntities>(),
  referencedTweets: text("referencedTweets", { mode: "json" }).$type<TwitterReferencedTweet[]>(),
  url: text("url"),
},
  (table) => [
    uniqueIndex("twitterTweet_tweetId_unique_idx").on(table.tweetId),
  ]);

export type TwitterTweetSelect = InferSelectModel<typeof twitterTweet>;
export type TwitterTweetInsert = InferInsertModel<typeof twitterTweet>;
