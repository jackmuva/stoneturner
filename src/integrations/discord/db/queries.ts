import { discordGuild, discordChannel, type DiscordGuildInsert, type DiscordGuildSelect, type DiscordChannelInsert, type DiscordChannelSelect } from './schema';
import { sql } from 'drizzle-orm';
import { PAGE_SIZE } from '@/lib/constants';
import { db } from '@/core/db/db';

export const batchInsertDiscordGuild = async (guilds: DiscordGuildInsert[]): Promise<void> => {
  await db.insert(discordGuild)
    .values(guilds)
    .onConflictDoUpdate({
      target: discordGuild.id,
      set: {
        name: sql`excluded.name`,
        icon: sql`excluded.icon`,
        banner: sql`excluded.banner`,
        owner: sql`excluded.owner`,
        permissions: sql`excluded.permissions`,
        features: sql`excluded.features`,
        approximateMemberCount: sql`excluded.approximateMemberCount`,
        approximatePresenceCount: sql`excluded.approximatePresenceCount`,
      }
    });
}

export const getDiscordGuilds = async (offset: number = 0): Promise<DiscordGuildSelect[]> => {
  return await db.select()
    .from(discordGuild)
    .limit(PAGE_SIZE)
    .offset(offset);
}

export const batchInsertDiscordChannel = async (channels: DiscordChannelInsert[]): Promise<void> => {
  await db.insert(discordChannel)
    .values(channels)
    .onConflictDoUpdate({
      target: discordChannel.id,
      set: {
        type: sql`excluded.type`,
        guildId: sql`excluded.guildId`,
        position: sql`excluded.position`,
        permissionOverwrites: sql`excluded.permissionOverwrites`,
        name: sql`excluded.name`,
        topic: sql`excluded.topic`,
        nsfw: sql`excluded.nsfw`,
        lastMessageId: sql`excluded.lastMessageId`,
        bitrate: sql`excluded.bitrate`,
        userLimit: sql`excluded.userLimit`,
        rateLimitPerUser: sql`excluded.rateLimitPerUser`,
        recipients: sql`excluded.recipients`,
        icon: sql`excluded.icon`,
        ownerId: sql`excluded.ownerId`,
        applicationId: sql`excluded.applicationId`,
        managed: sql`excluded.managed`,
        parentId: sql`excluded.parentId`,
        lastPinTimestamp: sql`excluded.lastPinTimestamp`,
        rtcRegion: sql`excluded.rtcRegion`,
        videoQualityMode: sql`excluded.videoQualityMode`,
        messageCount: sql`excluded.messageCount`,
        memberCount: sql`excluded.memberCount`,
        threadMetadata: sql`excluded.threadMetadata`,
        member: sql`excluded.member`,
        defaultAutoArchiveDuration: sql`excluded.defaultAutoArchiveDuration`,
        permissions: sql`excluded.permissions`,
        flags: sql`excluded.flags`,
        totalMessageSent: sql`excluded.totalMessageSent`,
        availableTags: sql`excluded.availableTags`,
        appliedTags: sql`excluded.appliedTags`,
        defaultReactionEmoji: sql`excluded.defaultReactionEmoji`,
        defaultThreadRateLimitPerUser: sql`excluded.defaultThreadRateLimitPerUser`,
        defaultSortOrder: sql`excluded.defaultSortOrder`,
        defaultForumLayout: sql`excluded.defaultForumLayout`,
      }
    });
}

export const getDiscordChannels = async (offset: number = 0): Promise<DiscordChannelSelect[]> => {
  return await db.select()
    .from(discordChannel)
    .limit(PAGE_SIZE)
    .offset(offset);
}

export const deleteAllDiscordData = async (): Promise<void> => {
  await db.delete(discordGuild);
  await db.delete(discordChannel);
}
