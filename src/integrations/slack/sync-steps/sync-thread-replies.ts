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

export type SlackSyncThreadRepliesInputs = { channelId: string; threadTs: string; cursor?: string };

export const syncThreadReplies = async (
  incremental: boolean = true,
  db: SqliteDb,
  inputs?: SlackSyncThreadRepliesInputs,
  syncTaskId?: string,
) => {
  let offset = 0;
  while (true) {
    const threads = await getSlackThreadParents(offset, db);
    if (threads.length === 0) break;

    const workerQueue = inputs
      ? threads.filter((thread) =>
        thread.channelId === inputs.channelId && thread.threadTs === inputs.threadTs
      )
      : threads;

    await Promise.allSettled(workerQueue.map((thread) =>
      slackApiBottleneck.schedule(() =>
        upsertThreadReplies(
          thread,
          incremental,
          db,
          inputs?.channelId === thread.channelId && inputs.threadTs === thread.threadTs
            ? inputs
            : undefined,
          syncTaskId,
        )
      )
    ));

    if (inputs) break;
    if (threads.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
};

const upsertThreadReplies = async (
  thread: { channelId: string; threadTs: string; latestReply: string | null },
  incremental: boolean,
  db: SqliteDb,
  inputs?: SlackSyncThreadRepliesInputs,
  syncTaskId?: string,
): Promise<void> => {
  let apiCursor: string | undefined = inputs?.cursor;

  try {
    if (!inputs && incremental) {
      const lastReplyTs = await getLastReplyTsByThread(thread.channelId, thread.threadTs, db);
      if (lastReplyTs && thread.latestReply && lastReplyTs >= thread.latestReply) {
        return;
      }
    }

    const token = await getSlackAccessToken(db);
    const { replies, nextCursor } = await retry(
      async () => fetchThreadRepliesPage(token, thread.channelId, thread.threadTs, apiCursor),
    );

    if (replies.length > 0) {
      await batchInsertSlackMessage(
        replies.map((message) => toSlackMessageInsert(
          message,
          thread.channelId,
          message.ts !== thread.threadTs,
        )),
        db,
      );
    }

    if (nextCursor) {
      await upsertSyncTask({
        id: syncTaskId,
        integration: "slack",
        status: "SUCCESS",
        step: "slack-sync-thread-replies",
        inputs: {
          channelId: thread.channelId,
          threadTs: thread.threadTs,
          cursor: nextCursor,
        },
      }, db);

      if (inputs) return;

      await upsertThreadReplies(thread, incremental, db, {
        channelId: thread.channelId,
        threadTs: thread.threadTs,
        cursor: nextCursor,
      }, syncTaskId);
      return;
    }

    await upsertSyncTask({
      id: syncTaskId,
      integration: "slack",
      status: "SUCCESS",
      step: "slack-sync-thread-replies",
      inputs: {
        channelId: thread.channelId,
        threadTs: thread.threadTs,
      },
    }, db);
  } catch (e) {
    await upsertSyncTask({
      id: syncTaskId,
      integration: "slack",
      status: "FAILED",
      step: "slack-sync-thread-replies",
      inputs: {
        channelId: thread.channelId,
        threadTs: thread.threadTs,
        cursor: apiCursor,
      },
      error: String(e),
    }, db);
  }
};

const fetchThreadRepliesPage = async (
  token: string,
  channelId: string,
  threadTs: string,
  cursor?: string,
): Promise<{ replies: SlackMessage[]; nextCursor?: string }> => {
  const response = await slackApiFetch<SlackConversationsRepliesResponse>("conversations.replies", token, {
    channel: channelId,
    ts: threadTs,
    limit: MAX_REPLIES,
    cursor,
  });

  const replies: SlackMessage[] = [];
  for (const message of response.messages) {
    if (shouldPersistSlackMessage(message)) {
      replies.push(message);
    }
  }

  return {
    replies,
    nextCursor: response.response_metadata?.next_cursor || undefined,
  };
};
