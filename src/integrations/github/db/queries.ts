import { sql } from "drizzle-orm";
import { PAGE_SIZE } from "@/lib/constants";
import type { SqliteDb } from "@/core/models/db-models";
import {
  githubIssue, type GithubIssueInsert, type GithubIssueSelect,
  githubPull, type GithubPullInsert, type GithubPullSelect,
  githubDoc, type GithubDocInsert, type GithubDocSelect,
  githubDiscussion, type GithubDiscussionInsert, type GithubDiscussionSelect,
  githubSourceFile, type GithubSourceFileInsert, type GithubSourceFileSelect,
} from "./schema";

// ---- Issues ----
export const batchInsertGithubIssue = async (rows: GithubIssueInsert[], db: SqliteDb): Promise<void> => {
  if (rows.length === 0) return;
  await db.insert(githubIssue).values(rows).onConflictDoUpdate({
    target: githubIssue.artifactId,
    set: {
      title: sql`excluded.title`,
      body: sql`excluded.body`,
      state: sql`excluded.state`,
      author: sql`excluded.author`,
      labels: sql`excluded.labels`,
      comments: sql`excluded.comments`,
      htmlUrl: sql`excluded.htmlUrl`,
      createdAt: sql`excluded.createdAt`,
      updatedAt: sql`excluded.updatedAt`,
    },
  });
};

export const getGithubIssues = async (offset: number, db: SqliteDb): Promise<GithubIssueSelect[]> => {
  return await db.select().from(githubIssue).limit(PAGE_SIZE).offset(offset);
};

export const getLatestGithubIssueUpdate = async (db: SqliteDb): Promise<string | null> => {
  const [row] = await db.select({ updatedAt: githubIssue.updatedAt }).from(githubIssue)
    .orderBy(sql`${githubIssue.updatedAt} desc`).limit(1);
  return row?.updatedAt ?? null;
};

// ---- Pulls ----
export const batchInsertGithubPull = async (rows: GithubPullInsert[], db: SqliteDb): Promise<void> => {
  if (rows.length === 0) return;
  await db.insert(githubPull).values(rows).onConflictDoUpdate({
    target: githubPull.artifactId,
    set: {
      title: sql`excluded.title`,
      body: sql`excluded.body`,
      state: sql`excluded.state`,
      author: sql`excluded.author`,
      files: sql`excluded.files`,
      reviewComments: sql`excluded.reviewComments`,
      htmlUrl: sql`excluded.htmlUrl`,
      createdAt: sql`excluded.createdAt`,
      updatedAt: sql`excluded.updatedAt`,
    },
  });
};

export const getGithubPulls = async (offset: number, db: SqliteDb): Promise<GithubPullSelect[]> => {
  return await db.select().from(githubPull).limit(PAGE_SIZE).offset(offset);
};

export const getLatestGithubPullUpdate = async (db: SqliteDb): Promise<string | null> => {
  const [row] = await db.select({ updatedAt: githubPull.updatedAt }).from(githubPull)
    .orderBy(sql`${githubPull.updatedAt} desc`).limit(1);
  return row?.updatedAt ?? null;
};

// ---- Docs ----
export const batchInsertGithubDoc = async (rows: GithubDocInsert[], db: SqliteDb): Promise<void> => {
  if (rows.length === 0) return;
  await db.insert(githubDoc).values(rows).onConflictDoUpdate({
    target: githubDoc.artifactId,
    set: {
      content: sql`excluded.content`,
      sha: sql`excluded.sha`,
    },
  });
};

export const getGithubDocs = async (offset: number, db: SqliteDb): Promise<GithubDocSelect[]> => {
  return await db.select().from(githubDoc).limit(PAGE_SIZE).offset(offset);
};

// ---- Discussions ----
export const batchInsertGithubDiscussion = async (rows: GithubDiscussionInsert[], db: SqliteDb): Promise<void> => {
  if (rows.length === 0) return;
  await db.insert(githubDiscussion).values(rows).onConflictDoUpdate({
    target: githubDiscussion.artifactId,
    set: {
      title: sql`excluded.title`,
      body: sql`excluded.body`,
      category: sql`excluded.category`,
      author: sql`excluded.author`,
      url: sql`excluded.url`,
      comments: sql`excluded.comments`,
      createdAt: sql`excluded.createdAt`,
    },
  });
};

export const getGithubDiscussions = async (offset: number, db: SqliteDb): Promise<GithubDiscussionSelect[]> => {
  return await db.select().from(githubDiscussion).limit(PAGE_SIZE).offset(offset);
};

// ---- Source files ----
export const batchInsertGithubSourceFile = async (rows: GithubSourceFileInsert[], db: SqliteDb): Promise<void> => {
  if (rows.length === 0) return;
  await db.insert(githubSourceFile).values(rows).onConflictDoUpdate({
    target: githubSourceFile.artifactId,
    set: {
      sha: sql`excluded.sha`,
      size: sql`excluded.size`,
      isMarkdown: sql`excluded.isMarkdown`,
      content: sql`excluded.content`,
    },
  });
};

export const getGithubSourceFiles = async (offset: number, db: SqliteDb): Promise<GithubSourceFileSelect[]> => {
  return await db.select().from(githubSourceFile).limit(PAGE_SIZE).offset(offset);
};

export const getGithubSourceFileByArtifactId = async (artifactId: string, db: SqliteDb): Promise<GithubSourceFileSelect | undefined> => {
  const [row] = await db.select().from(githubSourceFile).where(sql`"artifactId" = ${artifactId}`);
  return row;
};

// ---- Teardown ----
export const deleteGithubData = async (db: SqliteDb): Promise<void> => {
  await db.delete(githubIssue);
  await db.delete(githubPull);
  await db.delete(githubDoc);
  await db.delete(githubDiscussion);
  await db.delete(githubSourceFile);
};
