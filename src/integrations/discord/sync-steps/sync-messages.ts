import type { IntegrationCredential } from "@/core/db/schema/schema";
import type { DiscordMessage } from "../models/models"
import { DISCORD_API_ENDPOINT, getDiscordCredentials, refreshDiscordTokens } from "./discord-utils";
import { retry } from "@/lib/utils";
import { PAGE_SIZE, MAX_WORKERS } from "@/lib/constants";
import { batchInsertDiscordMessage, getDiscordChannels } from "../db/queries";
import { upsertSyncTask } from "@/core/db/queries/queries";
import type { DiscordChannelSelect } from "../db/schema";

export const syncMessages = async () => {
  let curOffset = 0;

  while (true) {
    const offsets = Array.from({ length: MAX_WORKERS }, (_, i) => curOffset + (i * PAGE_SIZE));
    const channelLists = await Promise.all(offsets.map((offset) => getDiscordChannels(offset)));
    const channels = channelLists.flat();

    if (channels.length === 0) break;

    await Promise.all(channels.map((channel) => upsertMessages(channel)));

    if (channelLists.some((channelList) => channelList.length < PAGE_SIZE)) break;
    curOffset += MAX_WORKERS * PAGE_SIZE;
  }
  return;
}

const upsertMessages = async (channel: DiscordChannelSelect): Promise<void> => {
  const lastMessageId = channel.lastMessageId;
  if (!lastMessageId) return;

  const messages: DiscordMessage[] | null = await retry(async () => {
    return await getMessages(channel.id, lastMessageId);
  }, 3, 1).catch(() => null);

  if (messages === null) {
    await upsertSyncTask({
      integration: "discord",
      status: "FAILED",
      step: "get-messages-by-channel",
      inputs: JSON.stringify({ channelId: channel.id }),
    })
    return;
  }

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
      mentionChannels: message.mention_channels,
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
  }))
}

const getMessages = async (channelId: string, lastMessageId: string): Promise<DiscordMessage[] | null> => {
  const discordCred: IntegrationCredential | null = await getDiscordCredentials();
  if (!discordCred) return null;

  const messageRes = await fetch(`${DISCORD_API_ENDPOINT}/channels/${channelId}/messages?before=${lastMessageId}&limit=100`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${discordCred.accessToken}`
    },
  });

  if (!messageRes.ok) {
    await refreshDiscordTokens();
    throw new Error(`discord get messages failed for channel ${channelId}: ${messageRes.status}`);
  }

  const messages: DiscordMessage[] = await messageRes.json();
  console.log("messages: ", messages);
  return messages;
}
