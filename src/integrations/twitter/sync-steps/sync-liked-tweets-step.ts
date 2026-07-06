import { upsertSyncTask } from "@/core/db/queries/queries";
import { withSyncTaskId } from "@/core/services/retry-cron";
import { retry } from "@/lib/utils";
import type { SqliteDb } from "@/core/models/db-models";
import { batchInsertTwitterTweet } from "../db/queries";
import type { TwitterTweetInsert } from "../db/schema";
import type { TwitterTweet, TwitterTweetListResponse } from "../models/models";
import {
  buildTweetUrl,
  getAuthenticatedTwitterUser,
  tweetFieldsParams,
  twitterFetchWithRefresh,
  userMapFromResponse,
} from "./twitter-utils";

const STEP = "twitter-sync-liked-tweets";
const LIKED_TWEETS_LIMIT = 100;

const tweetToRow = (
  tweet: TwitterTweet,
  userMap: Map<string, { username?: string; name?: string }>,
): TwitterTweetInsert => {
  const author = tweet.author_id ? userMap.get(tweet.author_id) : undefined;
  const username = author?.username;
  return {
    tweetId: tweet.id,
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

export const syncTwitterLikedTweetsStep = async (
  _incremental: boolean,
  db: SqliteDb,
  syncTaskId?: string,
): Promise<void> => {
  let userId: string;
  try {
    const user = await getAuthenticatedTwitterUser(db);
    userId = user.id;
  } catch (e) {
    await upsertSyncTask(withSyncTaskId({
      integration: "twitter",
      status: "FAILED",
      step: STEP,
      error: String(e),
    }, syncTaskId), db);
    return;
  }

  try {
    const body = await retry(async () =>
      await twitterFetchWithRefresh<TwitterTweetListResponse>(
        `/users/${userId}/liked_tweets`,
        db,
        { ...tweetFieldsParams(), max_results: String(LIKED_TWEETS_LIMIT) },
      ),
    );

    const userMap = userMapFromResponse(body);
    const tweets = body.data ?? [];
    const rows = tweets.map((tweet) => tweetToRow(tweet, userMap));

    await batchInsertTwitterTweet(rows, db);

    await upsertSyncTask(withSyncTaskId({
      integration: "twitter",
      status: "SUCCESS",
      step: STEP,
      inputs: { userId, limit: LIKED_TWEETS_LIMIT },
    }, syncTaskId), db);
  } catch (e) {
    await upsertSyncTask(withSyncTaskId({
      integration: "twitter",
      status: "FAILED",
      step: STEP,
      error: String(e),
    }, syncTaskId), db);
  }
};
