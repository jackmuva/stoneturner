import { discordGuild, discordChannel, discordMessage, type DiscordGuildInsert, type DiscordGuildSelect, type DiscordChannelInsert, type DiscordChannelSelect, type DiscordMessageInsert, type DiscordMessageSelect } from './schema';
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { PAGE_SIZE } from '@/lib/constants';
import type { SqliteDb } from '@/core/models/db-models';

export const batchInsertDiscordGuild = async (guilds: DiscordGuildInsert[], db: SqliteDb): Promise<void> => {
  await db.insert(discordGuild)
    .values(guilds)
    .onConflictDoUpdate({
      target: discordGuild.id,
      set: {
        name: sql`excluded.name`,
        icon: sql`excluded.icon`,
        iconHash: sql`excluded.iconHash`,
        splash: sql`excluded.splash`,
        discoverySplash: sql`excluded.discoverySplash`,
        owner: sql`excluded.owner`,
        ownerId: sql`excluded.ownerId`,
        permissions: sql`excluded.permissions`,
        region: sql`excluded.region`,
        afkChannelId: sql`excluded.afkChannelId`,
        afkTimeout: sql`excluded.afkTimeout`,
        widgetEnabled: sql`excluded.widgetEnabled`,
        widgetChannelId: sql`excluded.widgetChannelId`,
        verificationLevel: sql`excluded.verificationLevel`,
        defaultMessageNotifications: sql`excluded.defaultMessageNotifications`,
        explicitContentFilter: sql`excluded.explicitContentFilter`,
        roles: sql`excluded.roles`,
        emojis: sql`excluded.emojis`,
        features: sql`excluded.features`,
        mfaLevel: sql`excluded.mfaLevel`,
        applicationId: sql`excluded.applicationId`,
        systemChannelId: sql`excluded.systemChannelId`,
        systemChannelFlags: sql`excluded.systemChannelFlags`,
        rulesChannelId: sql`excluded.rulesChannelId`,
        maxPresences: sql`excluded.maxPresences`,
        maxMembers: sql`excluded.maxMembers`,
        vanityUrlCode: sql`excluded.vanityUrlCode`,
        description: sql`excluded.description`,
        banner: sql`excluded.banner`,
        premiumTier: sql`excluded.premiumTier`,
        premiumSubscriptionCount: sql`excluded.premiumSubscriptionCount`,
        preferredLocale: sql`excluded.preferredLocale`,
        publicUpdatesChannelId: sql`excluded.publicUpdatesChannelId`,
        maxVideoChannelUsers: sql`excluded.maxVideoChannelUsers`,
        maxStageVideoChannelUsers: sql`excluded.maxStageVideoChannelUsers`,
        approximateMemberCount: sql`excluded.approximateMemberCount`,
        approximatePresenceCount: sql`excluded.approximatePresenceCount`,
        welcomeScreen: sql`excluded.welcomeScreen`,
        nsfwLevel: sql`excluded.nsfwLevel`,
        stickers: sql`excluded.stickers`,
        premiumProgressBarEnabled: sql`excluded.premiumProgressBarEnabled`,
        safetyAlertsChannelId: sql`excluded.safetyAlertsChannelId`,
        incidentsData: sql`excluded.incidentsData`,
      }
    });
}

export const getDiscordGuilds = async (offset: number = 0, db: SqliteDb): Promise<DiscordGuildSelect[]> => {
  return await db.select()
    .from(discordGuild)
    .limit(PAGE_SIZE)
    .offset(offset);
}

export const batchInsertDiscordChannel = async (channels: DiscordChannelInsert[], db: SqliteDb): Promise<void> => {
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

export const getDiscordChannels = async (offset: number = 0, db: SqliteDb): Promise<DiscordChannelSelect[]> => {
  return await db.select()
    .from(discordChannel)
    .limit(PAGE_SIZE)
    .offset(offset);
}

export const getAllDiscordChannels = async (offset: number = 0, db: SqliteDb): Promise<DiscordChannelSelect[]> => {
  return await db.select().from(discordChannel).limit(PAGE_SIZE).offset(offset);
}

export const getDiscordChannelById = async (id: string, db: SqliteDb): Promise<DiscordChannelSelect | null> => {
  const [returning] = await db.select().from(discordChannel).where(eq(discordChannel.id, id))
  return returning ?? null;
}

export const deleteAllDiscordData = async (db: SqliteDb): Promise<void> => {
  await db.delete(discordGuild);
  await db.delete(discordChannel);
  await db.delete(discordMessage);
}

export const batchInsertDiscordMessage = async (messages: DiscordMessageInsert[], db: SqliteDb): Promise<void> => {
  await db.insert(discordMessage)
    .values(messages)
    .onConflictDoUpdate({
      target: discordMessage.id,
      set: {
        channelId: sql`excluded.channelId`,
        author: sql`excluded.author`,
        content: sql`excluded.content`,
        timestamp: sql`excluded.timestamp`,
        editedTimestamp: sql`excluded.editedTimestamp`,
        tts: sql`excluded.tts`,
        mentionEveryone: sql`excluded.mentionEveryone`,
        mentions: sql`excluded.mentions`,
        mentionRoles: sql`excluded.mentionRoles`,
        mentionChannels: sql`excluded.mentionChannels`,
        attachments: sql`excluded.attachments`,
        embeds: sql`excluded.embeds`,
        reactions: sql`excluded.reactions`,
        nonce: sql`excluded.nonce`,
        pinned: sql`excluded.pinned`,
        webhookId: sql`excluded.webhookId`,
        type: sql`excluded.type`,
        activity: sql`excluded.activity`,
        application: sql`excluded.application`,
        applicationId: sql`excluded.applicationId`,
        flags: sql`excluded.flags`,
        messageReference: sql`excluded.messageReference`,
        messageSnapshots: sql`excluded.messageSnapshots`,
        referencedMessageId: sql`excluded.referencedMessageId`,
        interactionMetadata: sql`excluded.interactionMetadata`,
        interaction: sql`excluded.interaction`,
        threadId: sql`excluded.threadId`,
        components: sql`excluded.components`,
        stickerItems: sql`excluded.stickerItems`,
        stickers: sql`excluded.stickers`,
        position: sql`excluded.position`,
        roleSubscriptionData: sql`excluded.roleSubscriptionData`,
        resolved: sql`excluded.resolved`,
        poll: sql`excluded.poll`,
        call: sql`excluded.call`,
        sharedClientTheme: sql`excluded.sharedClientTheme`,
      }
    });
}

export const getMessageTimestampRangeByChannelId = async (channelId: string, db: SqliteDb): Promise<{ minMessageTimestamp: string; maxMessageTimestamp: string } | undefined> => {
  const [record] = await db.select({
    minMessageTimestamp: sql<string>`MIN(${discordMessage.timestamp})`,
    maxMessageTimestamp: sql<string>`MAX(${discordMessage.timestamp})`,
  }).from(discordMessage)
    .where(eq(discordMessage.channelId, channelId));
  return record;
}

export const getTopLevelMessagesByChannelId = async (channelId: string, before: string, after: string, db: SqliteDb): Promise<DiscordMessageSelect[]> => {
  const filters = [
    eq(discordMessage.channelId, channelId),
    sql`${discordMessage.threadId} IS NULL`,
  ];
  filters.push(lte(discordMessage.timestamp, before));
  filters.push(gte(discordMessage.timestamp, after));

  return await db.select()
    .from(discordMessage)
    .where(and(...filters))
    .orderBy(asc(discordMessage.timestamp));
}

export const getMessagesByThreadId = async (threadId: string, db: SqliteDb): Promise<DiscordMessageSelect[]> => {
  const records = await db.select().from(discordMessage)
    .where(eq(discordMessage.threadId, threadId));
  return records;
}

export const getLastMessageByChannelId = async (channelId: string, db: SqliteDb): Promise<DiscordMessageSelect | null> => {
  const [returning] = await db.select().from(discordMessage)
    .where(eq(discordMessage.channelId, channelId))
    .orderBy(desc(discordMessage.timestamp))
    .limit(1);
  return returning ?? null;
}

export const getDiscordThreadIds = async (offset: number = 0, db: SqliteDb): Promise<{ channelId: string, threadId: string; lastMessageDate: string }[]> => {
  const records = await db.select({
    channelId: discordMessage.channelId,
    threadId: discordMessage.threadId,
    lastMessageDate: sql<string>`MAX(${discordMessage.timestamp})`,
  }).from(discordMessage)
    .where(sql`${discordMessage.threadId} IS NOT NULL`)
    .groupBy(discordMessage.channelId, discordMessage.threadId)
    .limit(PAGE_SIZE)
    .offset(offset);
  return records.map((r) => ({ channelId: r.channelId!, threadId: r.threadId!, lastMessageDate: r.lastMessageDate }));
}
