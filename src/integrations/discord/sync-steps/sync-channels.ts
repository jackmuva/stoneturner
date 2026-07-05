import type { DiscordChannel } from "../models/models";
import { DISCORD_API_ENDPOINT, discordApiBottleneck } from "./discord-utils";
import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { PAGE_SIZE } from "@/lib/constants";
import { batchInsertDiscordChannel, getDiscordGuilds } from "../db/queries";
import type { DiscordGuildSelect } from "../db/schema";
import type { SqliteDb } from "@/core/models/db-models";

export const syncChannels = async (db: SqliteDb, incremental: boolean = true, guildId?: string) => {
  let curOffset = 0;
  let guilds: DiscordGuildSelect[] = await getDiscordGuilds(curOffset, db);

  while (guilds.length > 0) {
    const workerQueue = guildId ? guilds.filter((guild) => guild.id === guildId) : guilds;
    await Promise.allSettled(workerQueue.map((guild) =>
      discordApiBottleneck.schedule(() => upsertChannels(guild, db))
    ));

    if (guilds.length < PAGE_SIZE) break;
    curOffset += PAGE_SIZE;
    guilds = await getDiscordGuilds(curOffset, db);
  }
  return;
}

const upsertChannels = async (guild: DiscordGuildSelect, db: SqliteDb): Promise<void> => {
  try {
    const channels: DiscordChannel[] = await retry(async () => {
      return await getChannelsByGuild(guild.id);
    });

    if (channels.length === 0) return;
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
    }), db);

    await upsertSyncTask({
      integration: "discord",
      status: "SUCCESS",
      step: "discord-sync-channel-by-guild",
      inputs: JSON.stringify({ guildId: guild.id }),
    }, db);
  } catch (e) {
    await upsertSyncTask({
      integration: "discord",
      status: "FAILED",
      step: "discord-sync-channel-by-guild",
      inputs: JSON.stringify({ guildId: guild.id, error: e }),
    }, db);
  }
  return;
}


const getChannelsByGuild = async (guildId: string): Promise<DiscordChannel[]> => {
  const channelRes = await fetch(`${DISCORD_API_ENDPOINT}/guilds/${guildId}/channels`, {
    method: "GET",
    headers: {
      "Authorization": `Bot ${process.env.DISCORD_BOT_TOKEN}`
    },
  });

  if (!channelRes.ok) {
    console.log("failed to get channels", await channelRes.json());
    throw new Error(`discord get channels failed for guild ${guildId}: ${channelRes.status}`);
  };

  const channelList: DiscordChannel[] = await channelRes.json()
  return channelList;
}
