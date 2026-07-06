import type { DiscordMessage } from "../models/models"
import { DISCORD_API_ENDPOINT, discordApiBottleneck } from "./discord-utils";
import { retry } from "@/lib/utils";
import { PAGE_SIZE } from "@/lib/constants";
import { batchInsertDiscordMessage, getDiscordChannels, getLastMessageByChannelId } from "../db/queries";
import { upsertSyncTask } from "@/core/db/queries/queries";
import type { DiscordChannelSelect } from "../db/schema";
import type { SqliteDb } from "@/core/models/db-models";

const MAX_MESSAGES = 100;

export type DiscordSyncMessagesInputs = { channelId: string; cursor?: string };

export const syncMessages = async (incremental: boolean = true, db: SqliteDb, inputs?: DiscordSyncMessagesInputs, syncTaskId?: string) => {
  const channelId = inputs?.channelId;
  const lastMessageId = inputs?.cursor;
  const resumeCursor = channelId && lastMessageId ? { channelId, lastMessageId } : undefined;
  let offset = 0;
  while (true) {
    const channels = await getDiscordChannels(offset, db);
    if (channels.length === 0) break;
    const workerQueue = resumeCursor ? channels.filter((channel) => channel.id === resumeCursor.channelId) : channels;
    await Promise.all(workerQueue.map((channel) =>
      discordApiBottleneck.schedule(() => upsertMessages(channel, incremental, db, resumeCursor?.lastMessageId, syncTaskId))
    ));
    if (channels.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
}

const upsertMessages = async (channel: DiscordChannelSelect, incremental: boolean, db: SqliteDb, cursor?: string, syncTaskId?: string): Promise<void> => {
  let lastMessageId: undefined | string = cursor;
  try {
    if (incremental) {
      const lastMessage = await getLastMessageByChannelId(channel.id, db);
      if (lastMessage) lastMessageId = lastMessage.id;
    }

    const messages: DiscordMessage[] = await retry(async () => {
      return await getMessages(channel.id, lastMessageId);
    });

    if (messages.length === 0) return;

    await batchInsertDiscordMessage(messages.map((message) => {
      return {
        id: message.id,
        channelId: message.channel_id,
        author: message.author,
        content: message.content,
        timestamp: message.timestamp,
        editedTimestamp: message.edited_timestamp,
        tts: message.tts,
        mentionEveryone: message.mention_everyone,
        mentions: message.mentions,
        mentionRoles: message.mention_roles,
        mentionChannels: message.mention_channels ?? undefined,
        attachments: message.attachments,
        embeds: message.embeds,
        reactions: message.reactions,
        nonce: message.nonce != null ? String(message.nonce) : null,
        pinned: message.pinned,
        webhookId: message.webhook_id,
        type: message.type,
        activity: message.activity,
        application: message.application,
        applicationId: message.application_id,
        flags: message.flags,
        messageReference: message.message_reference,
        messageSnapshots: message.message_snapshots,
        referencedMessageId: message.referenced_message?.message_id,
        interactionMetadata: message.interaction_metadata,
        interaction: message.interaction,
        threadId: message.thread?.id,
        components: message.components,
        stickerItems: message.sticker_items,
        stickers: message.stickers,
        position: message.position,
        roleSubscriptionData: message.role_subscription_data,
        resolved: message.resolved,
        poll: message.poll,
        call: message.call,
        sharedClientTheme: message.shared_client_theme,
      }
    }), db);

    await upsertSyncTask({
      id: syncTaskId,
      integration: "discord",
      status: "SUCCESS",
      step: "discord-sync-channel",
      inputs: { channelId: channel.id, cursor: lastMessageId },
    }, db);

    if (messages.length === MAX_MESSAGES) {
      await upsertMessages(channel, incremental, db, messages.at(-1)!.id, syncTaskId);
    }
  } catch (e) {
    await upsertSyncTask({
      id: syncTaskId,
      integration: "discord",
      status: "FAILED",
      step: "discord-sync-channel",
      inputs: { channelId: channel.id, cursor: lastMessageId },
      error: String(e),
    }, db);
    return;
  }
}

const getMessages = async (channelId: string, lastMessageId?: string): Promise<DiscordMessage[]> => {
  const urlParams = new URLSearchParams({
    limit: String(MAX_MESSAGES)
  })
  if (lastMessageId) urlParams.set("after", lastMessageId);
  const messageRes = await fetch(`${DISCORD_API_ENDPOINT}/channels/${channelId}/messages?${urlParams.toString()}`, {
    method: "GET",
    headers: {
      "Authorization": `Bot ${process.env.DISCORD_BOT_TOKEN}`
    },
  });

  if (!messageRes.ok) {
    throw new Error(`discord get messages failed for channel ${channelId}: ${messageRes.status}`);
  }

  const messages: DiscordMessage[] = await messageRes.json();
  return messages;
}
