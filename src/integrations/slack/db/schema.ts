import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { SlackReaction } from "../models/models";

export const slackTeam = sqliteTable("slackTeam", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain"),
  enterpriseId: text("enterpriseId"),
  isEnterpriseInstall: integer("isEnterpriseInstall", { mode: "boolean" }).notNull().default(false),
}, (table) => [
  uniqueIndex("slackTeam_id_unique_idx").on(table.id),
]);

export type SlackTeamSelect = InferSelectModel<typeof slackTeam>;
export type SlackTeamInsert = InferInsertModel<typeof slackTeam>;

export const slackChannel = sqliteTable("slackChannel", {
  id: text("id").primaryKey(),
  teamId: text("teamId").notNull(),
  name: text("name").notNull(),
  topic: text("topic"),
  purpose: text("purpose"),
  numMembers: integer("numMembers"),
  isArchived: integer("isArchived", { mode: "boolean" }).notNull().default(false),
  created: integer("created"),
}, (table) => [
  uniqueIndex("slackChannel_id_unique_idx").on(table.id),
  index("slackChannel_teamId_idx").on(table.teamId),
]);

export type SlackChannelSelect = InferSelectModel<typeof slackChannel>;
export type SlackChannelInsert = InferInsertModel<typeof slackChannel>;

export const slackUser = sqliteTable("slackUser", {
  id: text("id").primaryKey(),
  teamId: text("teamId").notNull(),
  name: text("name").notNull(),
  realName: text("realName"),
  displayName: text("displayName"),
  isBot: integer("isBot", { mode: "boolean" }).notNull().default(false),
  deleted: integer("deleted", { mode: "boolean" }).notNull().default(false),
}, (table) => [
  uniqueIndex("slackUser_id_unique_idx").on(table.id),
  index("slackUser_teamId_idx").on(table.teamId),
]);

export type SlackUserSelect = InferSelectModel<typeof slackUser>;
export type SlackUserInsert = InferInsertModel<typeof slackUser>;

export const slackMessage = sqliteTable("slackMessage", {
  id: text("id").primaryKey(),
  channelId: text("channelId").notNull(),
  ts: text("ts").notNull(),
  userId: text("userId"),
  text: text("text").notNull(),
  threadTs: text("threadTs"),
  isReply: integer("isReply", { mode: "boolean" }).notNull().default(false),
  replyCount: integer("replyCount"),
  latestReply: text("latestReply"),
  subtype: text("subtype"),
  editedTs: text("editedTs"),
  reactions: text("reactions", { mode: "json" }).$type<SlackReaction[]>(),
  attachments: text("attachments", { mode: "json" }).$type<unknown[]>(),
  blocks: text("blocks", { mode: "json" }).$type<unknown[]>(),
  botId: text("botId"),
}, (table) => [
  uniqueIndex("slackMessage_channelId_ts_unique_idx").on(table.channelId, table.ts),
  index("slackMessage_channelId_idx").on(table.channelId),
  index("slackMessage_threadTs_idx").on(table.threadTs),
]);

export type SlackMessageSelect = InferSelectModel<typeof slackMessage>;
export type SlackMessageInsert = InferInsertModel<typeof slackMessage>;
