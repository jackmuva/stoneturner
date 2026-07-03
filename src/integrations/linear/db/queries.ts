import { sql } from "drizzle-orm";
import { PAGE_SIZE } from "@/lib/constants";
import type { SqliteDb } from "@/core/models/db-models";
import {
  linearIssue, type LinearIssueInsert, type LinearIssueSelect,
  linearProject, type LinearProjectInsert, type LinearProjectSelect,
  linearDocument, type LinearDocumentInsert, type LinearDocumentSelect,
} from "./schema";

export const batchInsertLinearIssue = async (rows: LinearIssueInsert[], db: SqliteDb): Promise<void> => {
  if (rows.length === 0) return;
  await db.insert(linearIssue).values(rows).onConflictDoUpdate({
    target: linearIssue.issueId,
    set: {
      artifactId: sql`excluded.artifactId`,
      teamKey: sql`excluded.teamKey`,
      identifier: sql`excluded.identifier`,
      title: sql`excluded.title`,
      description: sql`excluded.description`,
      state: sql`excluded.state`,
      stateType: sql`excluded.stateType`,
      priority: sql`excluded.priority`,
      estimate: sql`excluded.estimate`,
      assignee: sql`excluded.assignee`,
      creator: sql`excluded.creator`,
      labels: sql`excluded.labels`,
      comments: sql`excluded.comments`,
      projectName: sql`excluded.projectName`,
      cycleName: sql`excluded.cycleName`,
      dueDate: sql`excluded.dueDate`,
      url: sql`excluded.url`,
      createdAt: sql`excluded.createdAt`,
      updatedAt: sql`excluded.updatedAt`,
    },
  });
};

export const getLinearIssues = async (offset: number, db: SqliteDb): Promise<LinearIssueSelect[]> => {
  return await db.select().from(linearIssue).limit(PAGE_SIZE).offset(offset);
};

export const getLatestLinearIssueUpdate = async (db: SqliteDb): Promise<string | null> => {
  const [row] = await db.select({ updatedAt: linearIssue.updatedAt }).from(linearIssue)
    .orderBy(sql`${linearIssue.updatedAt} desc`).limit(1);
  return row?.updatedAt ?? null;
};

export const batchInsertLinearProject = async (rows: LinearProjectInsert[], db: SqliteDb): Promise<void> => {
  if (rows.length === 0) return;
  await db.insert(linearProject).values(rows).onConflictDoUpdate({
    target: linearProject.projectId,
    set: {
      artifactId: sql`excluded.artifactId`,
      name: sql`excluded.name`,
      description: sql`excluded.description`,
      state: sql`excluded.state`,
      progress: sql`excluded.progress`,
      startDate: sql`excluded.startDate`,
      targetDate: sql`excluded.targetDate`,
      lead: sql`excluded.lead`,
      teamKeys: sql`excluded.teamKeys`,
      updates: sql`excluded.updates`,
      url: sql`excluded.url`,
      createdAt: sql`excluded.createdAt`,
      updatedAt: sql`excluded.updatedAt`,
    },
  });
};

export const getLinearProjects = async (offset: number, db: SqliteDb): Promise<LinearProjectSelect[]> => {
  return await db.select().from(linearProject).limit(PAGE_SIZE).offset(offset);
};

export const getLatestLinearProjectUpdate = async (db: SqliteDb): Promise<string | null> => {
  const [row] = await db.select({ updatedAt: linearProject.updatedAt }).from(linearProject)
    .orderBy(sql`${linearProject.updatedAt} desc`).limit(1);
  return row?.updatedAt ?? null;
};

export const batchInsertLinearDocument = async (rows: LinearDocumentInsert[], db: SqliteDb): Promise<void> => {
  if (rows.length === 0) return;
  await db.insert(linearDocument).values(rows).onConflictDoUpdate({
    target: linearDocument.documentId,
    set: {
      artifactId: sql`excluded.artifactId`,
      title: sql`excluded.title`,
      content: sql`excluded.content`,
      url: sql`excluded.url`,
      projectName: sql`excluded.projectName`,
      issueIdentifier: sql`excluded.issueIdentifier`,
      issueTitle: sql`excluded.issueTitle`,
      creator: sql`excluded.creator`,
      updatedBy: sql`excluded.updatedBy`,
      comments: sql`excluded.comments`,
      createdAt: sql`excluded.createdAt`,
      updatedAt: sql`excluded.updatedAt`,
    },
  });
};

export const getLinearDocuments = async (offset: number, db: SqliteDb): Promise<LinearDocumentSelect[]> => {
  return await db.select().from(linearDocument).limit(PAGE_SIZE).offset(offset);
};

export const getLatestLinearDocumentUpdate = async (db: SqliteDb): Promise<string | null> => {
  const [row] = await db.select({ updatedAt: linearDocument.updatedAt }).from(linearDocument)
    .orderBy(sql`${linearDocument.updatedAt} desc`).limit(1);
  return row?.updatedAt ?? null;
};

export const deleteLinearData = async (db: SqliteDb): Promise<void> => {
  await db.delete(linearIssue);
  await db.delete(linearProject);
  await db.delete(linearDocument);
};
