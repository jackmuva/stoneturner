import type { IntegrationCredential } from "@/core/db/schema/schema";
import type { DiscordChannel } from "../models/models";
import { DISCORD_API_ENDPOINT, getDiscordCredentials, refreshDiscordTokens } from "./discord-utils";
import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { PAGE_SIZE, MAX_WORKERS } from "@/lib/constants";
import { batchInsertDiscordChannel, getDiscordGuilds } from "../db/queries";
import type { DiscordGuildSelect } from "../db/schema";

export const syncChannels = async () => {
  let curOffset = 0;

  while (true) {
    const offsets = Array.from({ length: MAX_WORKERS }, (_, i) => curOffset + (i * PAGE_SIZE));
    const guildLists = await Promise.all(offsets.map((offset) => getDiscordGuilds(offset)));
    await Promise.all(guildLists.map((guildList) => upsertChannels(guildList)));

    if (guildLists.some((guildList) => guildList.length < PAGE_SIZE)) break;
    curOffset += MAX_WORKERS * PAGE_SIZE;
  }
  return;
}

const upsertChannels = async (guilds: DiscordGuildSelect[]): Promise<void> => {
  for (const guild of guilds) {
    const channels: DiscordChannel[] | null = await retry(async () => {
      return await getChannelsByGuild(guild.id);
    }, 3, 1).catch(() => null);
    if (channels === null) {
      await upsertSyncTask({
        integration: "discord",
        status: "FAILED",
        step: "get-channel-by-guild",
        inputs: JSON.stringify({ guildId: guild.id }),
      })
      continue;
    }
    if (channels.length === 0) continue;
    await batchInsertDiscordChannel(channels.map((channel) => {
      return {
        id: channel.id,
        type: channel.type,
        guildId: channel.guild_id,
        position: channel.position,
        permissionOverwrites: channel.permission_overwrites,
        name: channel.name,
        topic: channel.topic,
        nsfw: channel.nsfw,
        lastMessageId: channel.last_message_id,
        bitrate: channel.bitrate,
        userLimit: channel.user_limit,
        rateLimitPerUser: channel.rate_limit_per_user,
        recipients: channel.recipients,
        icon: channel.icon,
        ownerId: channel.owner_id,
        applicationId: channel.application_id,
        managed: channel.managed,
        parentId: channel.parent_id,
        lastPinTimestamp: channel.last_pin_timestamp,
        rtcRegion: channel.rtc_region,
        videoQualityMode: channel.video_quality_mode,
        messageCount: channel.message_count,
        memberCount: channel.member_count,
        threadMetadata: channel.thread_metadata,
        member: channel.member,
        defaultAutoArchiveDuration: channel.default_auto_archive_duration,
        permissions: channel.permissions,
        flags: channel.flags,
        totalMessageSent: channel.total_message_sent,
        availableTags: channel.available_tags,
        appliedTags: channel.applied_tags,
        defaultReactionEmoji: channel.default_reaction_emoji,
        defaultThreadRateLimitPerUser: channel.default_thread_rate_limit_per_user,
        defaultSortOrder: channel.default_sort_order,
        defaultForumLayout: channel.default_forum_layout,
      }
    }))
  }
  return;
}


const getChannelsByGuild = async (guildId: string): Promise<DiscordChannel[] | null> => {
  const discordCred: IntegrationCredential | null = await getDiscordCredentials();
  if (!discordCred) return null;

  const channelRes = await fetch(`${DISCORD_API_ENDPOINT}/guilds/${guildId}/channels`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${discordCred.accessToken}`
    },
  });

  if (!channelRes.ok) {
    await refreshDiscordTokens();
    throw new Error(`discord get channels failed for guild ${guildId}: ${channelRes.status}`);
  };

  const channelList: DiscordChannel[] = await channelRes.json()
  return channelList;
}
