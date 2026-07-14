import { sql } from "drizzle-orm";
import type { SqliteDb } from "@/core/models/db-models";
import {
  linearIssue,
  type LinearIssueInsert,
  linearProject,
  type LinearProjectInsert,
} from "./schema";

export const batchInsertLinearIssue = async (rows: LinearIssueInsert[], db: SqliteDb): Promise<void> => {
  if (rows.length === 0) return;
  await db.insert(linearIssue).values(rows).onConflictDoUpdate({
    target: linearIssue.issueId,
    set: {
      artifactId: sql`excluded.artifactId`,
      identifier: sql`excluded.identifier`,
      title: sql`excluded.title`,
      description: sql`excluded.description`,
      priority: sql`excluded.priority`,
      estimate: sql`excluded.estimate`,
      stateName: sql`excluded.stateName`,
      stateType: sql`excluded.stateType`,
      teamId: sql`excluded.teamId`,
      teamKey: sql`excluded.teamKey`,
      teamName: sql`excluded.teamName`,
      assignee: sql`excluded.assignee`,
      labels: sql`excluded.labels`,
      projectId: sql`excluded.projectId`,
      projectName: sql`excluded.projectName`,
      comments: sql`excluded.comments`,
      url: sql`excluded.url`,
      createdAt: sql`excluded.createdAt`,
      updatedAt: sql`excluded.updatedAt`,
    },
  });
};

export const getLatestLinearIssueUpdate = async (db: SqliteDb): Promise<string | null> => {
  const [row] = await db.select({ updatedAt: linearIssue.updatedAt }).from(linearIssue)
    .orderBy(sql`${linearIssue.updatedAt} desc`).limit(1);
  return row?.updatedAt ?? null;
};

export const getLinearIssues = async (offset: number, db: SqliteDb) => {
  return await db.select().from(linearIssue).limit(20).offset(offset);
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
      teamKeys: sql`excluded.teamKeys`,
      teamNames: sql`excluded.teamNames`,
      lead: sql`excluded.lead`,
      url: sql`excluded.url`,
      startDate: sql`excluded.startDate`,
      targetDate: sql`excluded.targetDate`,
      createdAt: sql`excluded.createdAt`,
      updatedAt: sql`excluded.updatedAt`,
    },
  });
};

export const getLatestLinearProjectUpdate = async (db: SqliteDb): Promise<string | null> => {
  const [row] = await db.select({ updatedAt: linearProject.updatedAt }).from(linearProject)
    .orderBy(sql`${linearProject.updatedAt} desc`).limit(1);
  return row?.updatedAt ?? null;
};

export const getLinearProjects = async (offset: number, db: SqliteDb) => {
  return await db.select().from(linearProject).limit(20).offset(offset);
};

export const deleteLinearData = async (db: SqliteDb): Promise<void> => {
  await db.delete(linearProject);
  await db.delete(linearIssue);
};
