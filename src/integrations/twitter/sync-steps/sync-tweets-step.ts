import { upsertSyncTask } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";
import { batchInsertTwitterTweet, getLatestTwitterTweetId } from "../db/queries";
import type { TwitterTweetInsert } from "../db/schema";
import type { TwitterTweet, TwitterTweetListResponse, TwitterTweetSource } from "../models/models";
import {
  buildTweetUrl,
  getTwitterCredentials,
  getTwitterUserId,
  tweetFieldsParams,
  twitterFetchWithRefresh,
  userMapFromResponse,
} from "./twitter-utils";

const tweetToRow = (
  tweet: TwitterTweet,
  source: TwitterTweetSource,
  userMap: Map<string, { username?: string; name?: string }>,
  fallbackUsername?: string,
): TwitterTweetInsert => {
  const author = tweet.author_id ? userMap.get(tweet.author_id) : undefined;
  const username = author?.username ?? fallbackUsername;
  return {
    tweetId: tweet.id,
    source,
    text: tweet.text,
    authorId: tweet.author_id,
    authorUsername: username,
    authorName: author?.name,
    createdAt: tweet.created_at,
    conversationId: tweet.conversation_id,
    inReplyToUserId: tweet.in_reply_to_user_id,
    lang: tweet.lang,
    publicMetrics: tweet.public_metrics,
    entities: tweet.entities,
    referencedTweets: tweet.referenced_tweets,
    url: buildTweetUrl(username, tweet.id),
  };
};

const syncTweetCollection = async (
  source: TwitterTweetSource,
  endpointSuffix: "tweets" | "mentions" | "bookmarks",
  incremental: boolean,
  db: SqliteDb,
): Promise<void> => {
  const step = `twitter-sync-${source}`;

  try {
    const userId = await getTwitterUserId(db);
    const cred = await getTwitterCredentials(db);
    const fallbackUsername = cred?.options?.username;

    let sinceId: string | null = null;
    if (incremental) {
      sinceId = await getLatestTwitterTweetId(source, db);
    }

    let paginationToken: string | undefined;
    let first = true;

    while (first || paginationToken) {
      first = false;
      const params: Record<string, string> = {
        ...tweetFieldsParams(),
      };
      if (sinceId) params.since_id = sinceId;
      if (paginationToken) params.pagination_token = paginationToken;

      let body: TwitterTweetListResponse;
      try {
        body = await twitterFetchWithRefresh<TwitterTweetListResponse>(
          `/users/${userId}/${endpointSuffix}`,
          db,
          params,
        );
      } catch (e) {
        await upsertSyncTask({
          integration: "twitter",
          status: "FAILED",
          step,
          inputs: { source, paginationToken, error: String(e) },
        }, db);
        return;
      }

      const userMap = userMapFromResponse(body);
      const tweets = body.data ?? [];
      const rows = tweets.map((tweet) => tweetToRow(tweet, source, userMap, fallbackUsername));

      try {
        await batchInsertTwitterTweet(rows, db);
        await upsertSyncTask({
          integration: "twitter",
          status: "SUCCESS",
          step,
          inputs: { source, count: rows.length, paginationToken: paginationToken ?? null },
        }, db);
      } catch (e) {
        await upsertSyncTask({
          integration: "twitter",
          status: "FAILED",
          step,
          inputs: { source, paginationToken, error: String(e) },
        }, db);
        return;
      }

      paginationToken = body.meta?.next_token;
      if (incremental && tweets.length === 0) break;
      if (!paginationToken) break;
    }
  } catch (e) {
    await upsertSyncTask({
      integration: "twitter",
      status: "FAILED",
      step,
      inputs: { source, error: String(e) },
    }, db);
  }
};

export const syncTwitterTweetsStep = async (incremental: boolean, db: SqliteDb): Promise<void> => {
  await syncTweetCollection("tweet", "tweets", incremental, db);
};

export const syncTwitterMentionsStep = async (incremental: boolean, db: SqliteDb): Promise<void> => {
  await syncTweetCollection("mention", "mentions", incremental, db);
};

export const syncTwitterBookmarksStep = async (incremental: boolean, db: SqliteDb): Promise<void> => {
  await syncTweetCollection("bookmark", "bookmarks", incremental, db);
};
