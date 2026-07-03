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

export const syncMessages = async (incremental: boolean = true, db: SqliteDb, channelId?: string) => {
  let offset = 0;
  while (true) {
    const channels = await getSlackChannels(offset, db);
    if (channels.length === 0) break;

    const workerQueue = channelId ? channels.filter((channel) => channel.id === channelId) : channels;
    await Promise.all(workerQueue.map((channel) =>
      slackApiBottleneck.schedule(() => upsertMessages(channel, incremental, db))
    ));

    if (channels.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
};

const upsertMessages = async (channel: SlackChannelSelect, incremental: boolean, db: SqliteDb): Promise<void> => {
  let oldest: string | undefined;
  try {
    if (incremental) {
      const lastMessage = await getLastMessageByChannelId(channel.id, db);
      if (lastMessage) oldest = lastMessage.ts;
    }

    const token = await getSlackAccessToken(db);
    const messages = await retry(async () => fetchChannelMessages(token, channel.id, oldest), 3, 1);
    if (messages.length === 0) return;

    await batchInsertSlackMessage(
      messages.map((message) => toSlackMessageInsert(message, channel.id, false)),
      db,
    );

    await upsertSyncTask({
      integration: "slack",
      status: "SUCCESS",
      step: "slack-sync-channel-messages",
      inputs: JSON.stringify({ channelId: channel.id, oldest, messageCount: messages.length }),
    }, db);
  } catch (e) {
    await upsertSyncTask({
      integration: "slack",
      status: "FAILED",
      step: "slack-sync-channel-messages",
      inputs: JSON.stringify({ channelId: channel.id, oldest, error: String(e) }),
    }, db);
  }
};

const fetchChannelMessages = async (
  token: string,
  channelId: string,
  oldest?: string,
): Promise<SlackMessage[]> => {
  const messages: SlackMessage[] = [];
  let cursor: string | undefined;

  do {
    const response = await slackApiFetch<SlackConversationsHistoryResponse>("conversations.history", token, {
      channel: channelId,
      limit: MAX_MESSAGES,
      cursor,
      oldest,
    });

    for (const message of response.messages) {
      if (shouldPersistSlackMessage(message)) {
        messages.push(message);
      }
    }

    cursor = response.response_metadata?.next_cursor || undefined;
    if (oldest) break;
  } while (cursor);

  return messages;
};
