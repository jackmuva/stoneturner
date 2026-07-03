import type { SlackMessage } from "../models/models";
import {
  getSlackAccessToken,
  shouldPersistSlackMessage,
  slackApiBottleneck,
  slackApiFetch,
  toSlackMessageInsert,
} from "./slack-utils";
import { retry } from "@/lib/utils";
import { PAGE_SIZE } from "@/lib/constants";
import {
  batchInsertSlackMessage,
  getLastReplyTsByThread,
  getSlackThreadParents,
} from "../db/queries";
import { upsertSyncTask } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";
import type { SlackConversationsRepliesResponse } from "../models/models";

const MAX_REPLIES = 200;

export const syncThreadReplies = async (incremental: boolean = true, db: SqliteDb) => {
  let offset = 0;
  while (true) {
    const threads = await getSlackThreadParents(offset, db);
    if (threads.length === 0) break;

    await Promise.allSettled(threads.map((thread) =>
      slackApiBottleneck.schedule(() => upsertThreadReplies(thread, incremental, db))
    ));

    if (threads.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
};

const upsertThreadReplies = async (
  thread: { channelId: string; threadTs: string; latestReply: string | null },
  incremental: boolean,
  db: SqliteDb,
): Promise<void> => {
  try {
    if (incremental) {
      const lastReplyTs = await getLastReplyTsByThread(thread.channelId, thread.threadTs, db);
      if (lastReplyTs && thread.latestReply && lastReplyTs >= thread.latestReply) {
        return;
      }
    }

    const token = await getSlackAccessToken(db);
    const replies = await retry(
      async () => fetchThreadReplies(token, thread.channelId, thread.threadTs),
      3,
      1,
    );
    if (replies.length === 0) return;

    await batchInsertSlackMessage(
      replies.map((message) => toSlackMessageInsert(
        message,
        thread.channelId,
        message.ts !== thread.threadTs,
      )),
      db,
    );

    await upsertSyncTask({
      integration: "slack",
      status: "SUCCESS",
      step: "slack-sync-thread-replies",
      inputs: JSON.stringify({ channelId: thread.channelId, threadTs: thread.threadTs, replyCount: replies.length }),
    }, db);
  } catch (e) {
    await upsertSyncTask({
      integration: "slack",
      status: "FAILED",
      step: "slack-sync-thread-replies",
      inputs: JSON.stringify({ channelId: thread.channelId, threadTs: thread.threadTs, error: String(e) }),
    }, db);
  }
};

const fetchThreadReplies = async (
  token: string,
  channelId: string,
  threadTs: string,
): Promise<SlackMessage[]> => {
  const messages: SlackMessage[] = [];
  let cursor: string | undefined;

  do {
    const response = await slackApiFetch<SlackConversationsRepliesResponse>("conversations.replies", token, {
      channel: channelId,
      ts: threadTs,
      limit: MAX_REPLIES,
      cursor,
    });

    for (const message of response.messages) {
      if (shouldPersistSlackMessage(message)) {
        messages.push(message);
      }
    }

    cursor = response.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return messages;
};
