import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { StoredComment, StoredProjectUpdate } from "../models/models";

export const linearIssue = sqliteTable("linearIssue", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  artifactId: text("artifactId").unique().notNull(),
  issueId: text("issueId").unique().notNull(),
  teamKey: text("teamKey").notNull(),
  identifier: text("identifier").notNull(),
  title: text("title"),
  description: text("description"),
  state: text("state"),
  stateType: text("stateType"),
  priority: integer("priority"),
  estimate: integer("estimate"),
  assignee: text("assignee"),
  creator: text("creator"),
  labels: text("labels", { mode: "json" }).$type<string[]>().$defaultFn(() => []),
  comments: text("comments", { mode: "json" }).$type<StoredComment[]>().$defaultFn(() => []),
  projectName: text("projectName"),
  cycleName: text("cycleName"),
  dueDate: text("dueDate"),
  url: text("url"),
  createdAt: text("createdAt"),
  updatedAt: text("updatedAt"),
}, (table) => [
  uniqueIndex("linearIssue_artifactId_unique_idx").on(table.artifactId),
  uniqueIndex("linearIssue_issueId_unique_idx").on(table.issueId),
]);

export type LinearIssueSelect = InferSelectModel<typeof linearIssue>;
export type LinearIssueInsert = InferInsertModel<typeof linearIssue>;

export const linearProject = sqliteTable("linearProject", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  artifactId: text("artifactId").unique().notNull(),
  projectId: text("projectId").unique().notNull(),
  name: text("name"),
  description: text("description"),
  state: text("state"),
  progress: text("progress"),
  startDate: text("startDate"),
  targetDate: text("targetDate"),
  lead: text("lead"),
  teamKeys: text("teamKeys", { mode: "json" }).$type<string[]>().$defaultFn(() => []),
  updates: text("updates", { mode: "json" }).$type<StoredProjectUpdate[]>().$defaultFn(() => []),
  url: text("url"),
  createdAt: text("createdAt"),
  updatedAt: text("updatedAt"),
}, (table) => [
  uniqueIndex("linearProject_artifactId_unique_idx").on(table.artifactId),
  uniqueIndex("linearProject_projectId_unique_idx").on(table.projectId),
]);

export type LinearProjectSelect = InferSelectModel<typeof linearProject>;
export type LinearProjectInsert = InferInsertModel<typeof linearProject>;

export const linearDocument = sqliteTable("linearDocument", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  artifactId: text("artifactId").unique().notNull(),
  documentId: text("documentId").unique().notNull(),
  title: text("title"),
  content: text("content"),
  url: text("url"),
  projectName: text("projectName"),
  issueIdentifier: text("issueIdentifier"),
  issueTitle: text("issueTitle"),
  creator: text("creator"),
  updatedBy: text("updatedBy"),
  comments: text("comments", { mode: "json" }).$type<StoredComment[]>().$defaultFn(() => []),
  createdAt: text("createdAt"),
  updatedAt: text("updatedAt"),
}, (table) => [
  uniqueIndex("linearDocument_artifactId_unique_idx").on(table.artifactId),
  uniqueIndex("linearDocument_documentId_unique_idx").on(table.documentId),
]);

export type LinearDocumentSelect = InferSelectModel<typeof linearDocument>;
export type LinearDocumentInsert = InferInsertModel<typeof linearDocument>;
