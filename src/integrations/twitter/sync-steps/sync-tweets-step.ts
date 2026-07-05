import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
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
  cursor?: string,
): Promise<void> => {
  const step = `twitter-sync-${source}`;

  let userId: string;
  let fallbackUsername: string | undefined;
  try {
    userId = await getTwitterUserId(db);
    const cred = await getTwitterCredentials(db);
    fallbackUsername = cred?.options?.username;
  } catch (e) {
    await upsertSyncTask({
      integration: "twitter",
      status: "FAILED",
      step,
      inputs: { cursor, source, error: e },
    }, db);
    return;
  }

  let sinceId: string | null = null;
  if (incremental) {
    sinceId = await getLatestTwitterTweetId(source, db);
  }

  let paginationToken: string | undefined = cursor;

  while (true) {
    const requestToken = paginationToken;
    let body: TwitterTweetListResponse | null = null;

    try {
      body = await retry(async () => {
        const params: Record<string, string> = {
          ...tweetFieldsParams(),
        };
        if (sinceId) params.since_id = sinceId;
        if (requestToken) params.pagination_token = requestToken;

        return await twitterFetchWithRefresh<TwitterTweetListResponse>(
          `/users/${userId}/${endpointSuffix}`,
          db,
          params,
        );
      });
    } catch (e) {
      await upsertSyncTask({
        integration: "twitter",
        status: "FAILED",
        step,
        inputs: { cursor: requestToken, source, error: e },
      }, db);
      break;
    }

    try {
      const userMap = userMapFromResponse(body);
      const tweets = body.data ?? [];
      const rows = tweets.map((tweet) => tweetToRow(tweet, source, userMap, fallbackUsername));

      await batchInsertTwitterTweet(rows, db);

      if (!body.meta?.next_token || (incremental && tweets.length === 0)) break;
      paginationToken = body.meta.next_token;

      await upsertSyncTask({
        integration: "twitter",
        status: "SUCCESS",
        step,
        inputs: { cursor: paginationToken, source, count: rows.length },
      }, db);
    } catch (e) {
      await upsertSyncTask({
        integration: "twitter",
        status: "FAILED",
        step,
        inputs: { cursor: requestToken, source, error: e },
      }, db);
      if (!body.meta?.next_token) break;
    }
  }
};

export const syncTwitterTweetsStep = async (
  incremental: boolean,
  db: SqliteDb,
  cursor?: string,
): Promise<void> => {
  await syncTweetCollection("tweet", "tweets", incremental, db, cursor);
};

export const syncTwitterMentionsStep = async (
  incremental: boolean,
  db: SqliteDb,
  cursor?: string,
): Promise<void> => {
  await syncTweetCollection("mention", "mentions", incremental, db, cursor);
};

export const syncTwitterBookmarksStep = async (
  incremental: boolean,
  db: SqliteDb,
  cursor?: string,
): Promise<void> => {
  await syncTweetCollection("bookmark", "bookmarks", incremental, db, cursor);
};
