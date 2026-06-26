import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
  PartialUser,
  PageIcon,
  FileObject,
  PageParent,
  PagePropertyValue,
} from "../models/models";

export const notionPage = sqliteTable("notionPage", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  pageId: text("pageId").unique().notNull(),
  createdTime: text("createdTime"),
  lastEditedTime: text("lastEditedTime"),
  createdBy: text("createdBy", { mode: "json" }).$type<PartialUser>(),
  lastEditedBy: text("lastEditedBy", { mode: "json" }).$type<PartialUser>(),
  archived: integer("archived", { mode: "boolean" }),
  inTrash: integer("inTrash", { mode: "boolean" }),
  icon: text("icon", { mode: "json" }).$type<PageIcon | null>(),
  cover: text("cover", { mode: "json" }).$type<FileObject | null>(),
  properties: text("properties", { mode: "json" }).$type<Record<string, PagePropertyValue>>(),
  parent: text("parent", { mode: "json" }).$type<PageParent>(),
  url: text("url"),
  publicUrl: text("publicUrl"),
},
  (table) => [
    uniqueIndex("notionPage_pageId_unique_idx").on(table.pageId),
  ]);

export type NotionPageSelect = InferSelectModel<typeof notionPage>;
export type NotionPageInsert = InferInsertModel<typeof notionPage>;

//NOTE: Consider adding pageId to batch select blocks
export const notionBlock = sqliteTable("notionBlock", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  blockId: text("blockId").unique().notNull(),
  type: text("type").notNull(),
  nextCursor: text("nextCursor"),
  hasMore: integer("hasMore", { mode: "boolean" }),
  hasChildren: integer("hasChildren", { mode: "boolean" }),
  childrenBlockIds: text("childrenBlockIds", { mode: "json" }).$type<string[]>().$defaultFn(() => []),
  text: text("text"),
  lastEditedTime: text("lastEditedTime"),
},
  (table) => [
    uniqueIndex("notionBlock_blockId_unique_idx").on(table.blockId),
  ]);

export type NotionBlockSelect = InferSelectModel<typeof notionBlock>;
export type NotionBlockInsert = InferInsertModel<typeof notionBlock>;
