import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { Overwrite, User, ThreadMetadata, ThreadMember, ForumTag, DefaultReaction } from "../models/models";

export const discordGuild = sqliteTable("discordGuild", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"),
  banner: text("banner"),
  owner: integer("owner", { mode: "boolean" }).notNull(),
  permissions: text("permissions").notNull(),
  features: text("features", { mode: "json" }).$type<string[]>().notNull(),
  approximateMemberCount: integer("approximateMemberCount"),
  approximatePresenceCount: integer("approximatePresenceCount"),
},
  (table) => [
    uniqueIndex("discordGuild_id_unique_idx").on(table.id),
  ]);

export type DiscordGuildSelect = InferSelectModel<typeof discordGuild>;
export type DiscordGuildInsert = InferInsertModel<typeof discordGuild>;

export const discordChannel = sqliteTable("discordChannel", {
  id: text("id").primaryKey(),
  type: integer("type").notNull(),
  guildId: text("guildId"),
  position: integer("position"),
  permissionOverwrites: text("permissionOverwrites", { mode: "json" }).$type<Overwrite[]>(),
  name: text("name"),
  topic: text("topic"),
  nsfw: integer("nsfw", { mode: "boolean" }),
  lastMessageId: text("lastMessageId"),
  bitrate: integer("bitrate"),
  userLimit: integer("userLimit"),
  rateLimitPerUser: integer("rateLimitPerUser"),
  recipients: text("recipients", { mode: "json" }).$type<User[]>(),
  icon: text("icon"),
  ownerId: text("ownerId"),
  applicationId: text("applicationId"),
  managed: integer("managed", { mode: "boolean" }),
  parentId: text("parentId"),
  lastPinTimestamp: text("lastPinTimestamp"),
  rtcRegion: text("rtcRegion"),
  videoQualityMode: integer("videoQualityMode"),
  messageCount: integer("messageCount"),
  memberCount: integer("memberCount"),
  threadMetadata: text("threadMetadata", { mode: "json" }).$type<ThreadMetadata>(),
  member: text("member", { mode: "json" }).$type<ThreadMember>(),
  defaultAutoArchiveDuration: integer("defaultAutoArchiveDuration"),
  permissions: text("permissions"),
  flags: integer("flags"),
  totalMessageSent: integer("totalMessageSent"),
  availableTags: text("availableTags", { mode: "json" }).$type<ForumTag[]>(),
  appliedTags: text("appliedTags", { mode: "json" }).$type<string[]>(),
  defaultReactionEmoji: text("defaultReactionEmoji", { mode: "json" }).$type<DefaultReaction>(),
  defaultThreadRateLimitPerUser: integer("defaultThreadRateLimitPerUser"),
  defaultSortOrder: integer("defaultSortOrder"),
  defaultForumLayout: integer("defaultForumLayout"),
},
  (table) => [
    uniqueIndex("discordChannel_id_unique_idx").on(table.id),
  ]);

export type DiscordChannelSelect = InferSelectModel<typeof discordChannel>;
export type DiscordChannelInsert = InferInsertModel<typeof discordChannel>;
