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
import { batchInsertSlackMessage, getLastMessageByChannelId, getSlackChannels } from "../db/queries";
import { upsertSyncTask } from "@/core/db/queries/queries";
import type { SlackChannelSelect } from "../db/schema";
import type { SqliteDb } from "@/core/models/db-models";
import type { SlackConversationsHistoryResponse } from "../models/models";

const MAX_MESSAGES = 200;

export type SlackSyncMessagesInputs = { channelId: string; cursor?: string; oldest?: string };

export const syncMessages = async (incremental: boolean = true, db: SqliteDb, inputs?: SlackSyncMessagesInputs, syncTaskId?: string) => {
  let offset = 0;
  while (true) {
    const channels = await getSlackChannels(offset, db);
    if (channels.length === 0) break;

    const workerQueue = inputs ? channels.filter((channel) => channel.id === inputs.channelId) : channels;
    await Promise.all(workerQueue.map((channel) =>
      slackApiBottleneck.schedule(() =>
        upsertMessages(
          channel,
          incremental,
          db,
          inputs?.channelId === channel.id ? inputs : undefined,
          syncTaskId,
        )
      )
    ));

    if (inputs) break;
    if (channels.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
};

const upsertMessages = async (
  channel: SlackChannelSelect,
  incremental: boolean,
  db: SqliteDb,
  inputs?: SlackSyncMessagesInputs,
  syncTaskId?: string,
): Promise<void> => {
  let oldest: string | undefined = inputs?.oldest;
  let apiCursor: string | undefined = inputs?.cursor;

  try {
    if (!inputs && incremental) {
      const lastMessage = await getLastMessageByChannelId(channel.id, db);
      if (lastMessage) oldest = lastMessage.ts;
    }

    const token = await getSlackAccessToken(db);
    const { messages, nextCursor } = await retry(
      async () => fetchChannelMessagesPage(token, channel.id, oldest, apiCursor),
    );

    if (messages.length > 0) {
      await batchInsertSlackMessage(
        messages.map((message) => toSlackMessageInsert(message, channel.id, false)),
        db,
      );
    }

    if (nextCursor && !oldest) {
      await upsertSyncTask({
        id: syncTaskId,
        integration: "slack",
        status: "SUCCESS",
        step: "slack-sync-channel-messages",
        inputs: { channelId: channel.id, oldest, cursor: nextCursor },
      }, db);

      if (inputs) return;

      await upsertMessages(channel, incremental, db, {
        channelId: channel.id,
        oldest,
        cursor: nextCursor,
      }, syncTaskId);
      return;
    }

    await upsertSyncTask({
      id: syncTaskId,
      integration: "slack",
      status: "SUCCESS",
      step: "slack-sync-channel-messages",
      inputs: { channelId: channel.id, oldest },
    }, db);
  } catch (e) {
    await upsertSyncTask({
      id: syncTaskId,
      integration: "slack",
      status: "FAILED",
      step: "slack-sync-channel-messages",
      inputs: { channelId: channel.id, oldest, cursor: apiCursor },
      error: String(e),
    }, db);
  }
};

const fetchChannelMessagesPage = async (
  token: string,
  channelId: string,
  oldest?: string,
  cursor?: string,
): Promise<{ messages: SlackMessage[]; nextCursor?: string }> => {
  const response = await slackApiFetch<SlackConversationsHistoryResponse>("conversations.history", token, {
    channel: channelId,
    limit: MAX_MESSAGES,
    cursor,
    oldest,
  });

  const messages: SlackMessage[] = [];
  for (const message of response.messages) {
    if (shouldPersistSlackMessage(message)) {
      messages.push(message);
    }
  }

  const nextCursor = !oldest
    ? response.response_metadata?.next_cursor || undefined
    : undefined;

  return { messages, nextCursor };
};
