import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { StoredLinearComment } from "../models/models";

export const linearIssue = sqliteTable("linearIssue", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  issueId: text("issueId").unique().notNull(),
  artifactId: text("artifactId").unique().notNull(),
  identifier: text("identifier").notNull(),
  title: text("title"),
  description: text("description"),
  priority: integer("priority"),
  estimate: real("estimate"),
  stateName: text("stateName"),
  stateType: text("stateType"),
  teamId: text("teamId"),
  teamKey: text("teamKey"),
  teamName: text("teamName"),
  assignee: text("assignee"),
  labels: text("labels", { mode: "json" }).$type<string[]>().$defaultFn(() => []),
  projectId: text("projectId"),
  projectName: text("projectName"),
  comments: text("comments", { mode: "json" }).$type<StoredLinearComment[]>().$defaultFn(() => []),
  url: text("url"),
  createdAt: text("createdAt"),
  updatedAt: text("updatedAt"),
}, (table) => [
  uniqueIndex("linearIssue_issueId_unique_idx").on(table.issueId),
  uniqueIndex("linearIssue_artifactId_unique_idx").on(table.artifactId),
]);

export type LinearIssueSelect = InferSelectModel<typeof linearIssue>;
export type LinearIssueInsert = InferInsertModel<typeof linearIssue>;

export const linearProject = sqliteTable("linearProject", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("projectId").unique().notNull(),
  artifactId: text("artifactId").unique().notNull(),
  name: text("name"),
  description: text("description"),
  state: text("state"),
  progress: real("progress"),
  teamKeys: text("teamKeys", { mode: "json" }).$type<string[]>().$defaultFn(() => []),
  teamNames: text("teamNames", { mode: "json" }).$type<string[]>().$defaultFn(() => []),
  lead: text("lead"),
  url: text("url"),
  startDate: text("startDate"),
  targetDate: text("targetDate"),
  createdAt: text("createdAt"),
  updatedAt: text("updatedAt"),
}, (table) => [
  uniqueIndex("linearProject_projectId_unique_idx").on(table.projectId),
  uniqueIndex("linearProject_artifactId_unique_idx").on(table.artifactId),
]);

export type LinearProjectSelect = InferSelectModel<typeof linearProject>;
export type LinearProjectInsert = InferInsertModel<typeof linearProject>;
