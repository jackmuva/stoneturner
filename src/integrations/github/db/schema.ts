import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { StoredComment, StoredPullFile, StoredReviewComment } from "../models/models";

// One row per GitHub issue (PRs are excluded at fetch time).
export const githubIssue = sqliteTable("githubIssue", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  artifactId: text("artifactId").unique().notNull(), // `${owner}/${repo}#issue-${number}`
  repo: text("repo").notNull(),                       // `owner/repo`
  number: integer("number").notNull(),
  title: text("title"),
  body: text("body"),
  state: text("state"),
  author: text("author"),
  labels: text("labels", { mode: "json" }).$type<string[]>().$defaultFn(() => []),
  comments: text("comments", { mode: "json" }).$type<StoredComment[]>().$defaultFn(() => []),
  htmlUrl: text("htmlUrl"),
  createdAt: text("createdAt"),
  updatedAt: text("updatedAt"),
}, (table) => [
  uniqueIndex("githubIssue_artifactId_unique_idx").on(table.artifactId),
]);

export type GithubIssueSelect = InferSelectModel<typeof githubIssue>;
export type GithubIssueInsert = InferInsertModel<typeof githubIssue>;

// One row per GitHub pull request.
export const githubPull = sqliteTable("githubPull", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  artifactId: text("artifactId").unique().notNull(), // `${owner}/${repo}#pr-${number}`
  repo: text("repo").notNull(),
  number: integer("number").notNull(),
  title: text("title"),
  body: text("body"),
  state: text("state"),
  author: text("author"),
  files: text("files", { mode: "json" }).$type<StoredPullFile[]>().$defaultFn(() => []),
  reviewComments: text("reviewComments", { mode: "json" }).$type<StoredReviewComment[]>().$defaultFn(() => []),
  htmlUrl: text("htmlUrl"),
  createdAt: text("createdAt"),
  updatedAt: text("updatedAt"),
}, (table) => [
  uniqueIndex("githubPull_artifactId_unique_idx").on(table.artifactId),
]);

export type GithubPullSelect = InferSelectModel<typeof githubPull>;
export type GithubPullInsert = InferInsertModel<typeof githubPull>;

// One row per repo doc file (README + docs/ + root .md files).
export const githubDoc = sqliteTable("githubDoc", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  artifactId: text("artifactId").unique().notNull(), // `${owner}/${repo}:doc:${path}`
  repo: text("repo").notNull(),
  path: text("path").notNull(),
  content: text("content"),
  sha: text("sha"),
}, (table) => [
  uniqueIndex("githubDoc_artifactId_unique_idx").on(table.artifactId),
]);

export type GithubDocSelect = InferSelectModel<typeof githubDoc>;
export type GithubDocInsert = InferInsertModel<typeof githubDoc>;

// One row per GitHub discussion thread.
export const githubDiscussion = sqliteTable("githubDiscussion", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  artifactId: text("artifactId").unique().notNull(), // `${owner}/${repo}#discussion-${number}`
  repo: text("repo").notNull(),
  number: integer("number").notNull(),
  title: text("title"),
  body: text("body"),
  category: text("category"),
  author: text("author"),
  url: text("url"),
  comments: text("comments", { mode: "json" }).$type<StoredComment[]>().$defaultFn(() => []),
  createdAt: text("createdAt"),
}, (table) => [
  uniqueIndex("githubDiscussion_artifactId_unique_idx").on(table.artifactId),
]);

export type GithubDiscussionSelect = InferSelectModel<typeof githubDiscussion>;
export type GithubDiscussionInsert = InferInsertModel<typeof githubDiscussion>;

// One row per source/config/doc file discovered in the repo tree.
export const githubSourceFile = sqliteTable("githubSourceFile", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  artifactId: text("artifactId").unique().notNull(), // `${owner}/${repo}:code:${path}`
  repo: text("repo").notNull(),
  path: text("path").notNull(),
  sha: text("sha"),
  size: integer("size"),
  isMarkdown: integer("isMarkdown", { mode: "boolean" }),
  content: text("content"),
}, (table) => [
  uniqueIndex("githubSourceFile_artifactId_unique_idx").on(table.artifactId),
]);

export type GithubSourceFileSelect = InferSelectModel<typeof githubSourceFile>;
export type GithubSourceFileInsert = InferInsertModel<typeof githubSourceFile>;
