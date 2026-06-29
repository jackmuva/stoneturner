import { type IntegrationCredential, integrationCredential, type SyncTaskInsert, type SyncTaskSelect, syncTask, type MdArtifactSelect, type MdArtifactInsert, mdArtifact, type IntegrationCredentialInsert } from '@/core/db/schema/schema';
import { and, eq, gte, like, lte, gt, or, asc, desc, sql } from 'drizzle-orm';
import { PAGE_SIZE } from '@/lib/constants';
import { db as defaultDb } from '@/core/db/db';
import type { SqliteDb } from '@/core/models/db-models';
import { lower } from '@/lib/utils';

export const getIntegrationCredentials = async (db: SqliteDb): Promise<IntegrationCredential[]> => {
  return await db.select().from(integrationCredential);
}

export const getIntegrationCredentialByIntegration = async (integrationName: string, db: SqliteDb): Promise<IntegrationCredential | undefined> => {
  const [record] = await db.select().from(integrationCredential).where(eq(lower(integrationCredential.integration), integrationName.toLowerCase()));
  return record;
}

export const upsertIntegrationCredential = async (integrationData: IntegrationCredentialInsert, db: SqliteDb): Promise<void> => {
  const existing = await getIntegrationCredentialByIntegration(integrationData.integration, db);
  if (existing) {
    await db.update(integrationCredential).set({
      integrationType: integrationData.integrationType,
      apiKey: integrationData.apiKey,
      accessToken: integrationData.accessToken,
      refreshToken: integrationData.refreshToken,
      accessKey: integrationData.accessKey,
      secretKey: integrationData.secretKey,
      baseUrl: integrationData.baseUrl,
      tokenExpiration: integrationData.tokenExpiration,
      options: integrationData.options,
    }).where(sql`"id" = ${existing.id}`);
  } else {
    await db.insert(integrationCredential).values(integrationData);
  }
}

export const getSyncTasks = async (offset: number = 0, sortOrder: SortOrder = "desc", db: SqliteDb): Promise<SyncTaskSelect[]> => {
  const orderBy = sortOrder === "asc" ? asc(syncTask.updateDate) : desc(syncTask.updateDate);
  return await db.select().from(syncTask).orderBy(orderBy).offset(offset).limit(PAGE_SIZE);
}

export const getSyncTasksByIntegration = async (integration: string, offset: number = 0, sortOrder: SortOrder = "desc", db: SqliteDb): Promise<SyncTaskSelect[] | undefined> => {
  const orderBy = sortOrder === "asc" ? asc(syncTask.updateDate) : desc(syncTask.updateDate);
  return await db.select().from(syncTask).where(and(eq(lower(syncTask.integration), integration.toLowerCase()))).orderBy(orderBy).limit(PAGE_SIZE).offset(offset);
}

export const upsertSyncTask = async (syncTaskData: SyncTaskInsert, db: SqliteDb): Promise<void> => {
  if (syncTaskData.id) {
    const [existing] = await db.select().from(syncTask).where(eq(syncTask.id, syncTaskData.id));
    if (existing) {
      await db.update(syncTask).set({
        integration: syncTaskData.integration,
        updateDate: (new Date()).toISOString(),
        status: syncTaskData.status,
        inputs: syncTaskData.inputs,
        step: syncTaskData.step,
      }).where(sql`"id" = ${existing.id}`);
      return;
    }
  }
  await db.insert(syncTask).values(syncTaskData);
}

export const getSyncTasksByStatus = async (status: "FAILED" | "PENDING" | "SUCCESS", offset: number = 0, sortOrder: SortOrder = "desc", db: SqliteDb): Promise<SyncTaskSelect[] | undefined> => {
  const orderBy = sortOrder === "asc" ? asc(syncTask.updateDate) : desc(syncTask.updateDate);
  return await db.select().from(syncTask).where(eq(syncTask.status, status)).orderBy(orderBy).offset(offset).limit(PAGE_SIZE);
}

export const getSyncTasksFiltered = async (filters: {
  integration?: string;
  status?: "FAILED" | "PENDING" | "SUCCESS";
  step?: string;
  offset?: number;
  sortOrder?: SortOrder;
}, db: SqliteDb): Promise<SyncTaskSelect[]> => {
  const { integration, status, step, offset = 0, sortOrder = "desc" } = filters;
  const conditions = [
    integration ? eq(lower(syncTask.integration), integration.toLowerCase()) : undefined,
    status ? eq(syncTask.status, status) : undefined,
    step ? eq(syncTask.step, step) : undefined,
  ].filter(Boolean);
  const orderBy = sortOrder === "asc" ? asc(syncTask.updateDate) : desc(syncTask.updateDate);
  return await db.select().from(syncTask)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(orderBy).offset(offset).limit(PAGE_SIZE);
}

export const getDistinctSyncTaskSteps = async (db: SqliteDb): Promise<string[]> => {
  const rows = await db.selectDistinct({ step: syncTask.step }).from(syncTask).orderBy(asc(syncTask.step));
  return rows.map((r) => r.step).filter((s): s is string => s !== null);
}

export const getSyncTasksByUpdateDateAfter = async (updateDate: string, db: SqliteDb): Promise<SyncTaskSelect[]> => {
  return await db.select().from(syncTask).where(gt(syncTask.updateDate, updateDate));
}

export const getMdArtifactById = async (id: string, db: SqliteDb): Promise<MdArtifactSelect[]> => {
  return await db.select().from(mdArtifact).where(eq(mdArtifact.id, id));
}

export type MdArtifactSortField = "updateDate" | "artifactDate";
export type SortOrder = "asc" | "desc";

export const getMdArtifactsByIntegration = async (
  db: SqliteDb,
  integration: string,
  offset: number = 0,
  options?: {
    search?: string,
    sortBy?: MdArtifactSortField,
    sortOrder?: SortOrder,
  },
): Promise<MdArtifactSelect[]> => {
  const conditions = [eq(lower(mdArtifact.integration), integration.toLowerCase())];
  if (options?.search) {
    const term = `%${options.search}%`;
    conditions.push(
      or(
        like(mdArtifact.markdown, term),
        like(mdArtifact.keyPoints, term),
        like(mdArtifact.questionsAnswered, term),
        like(mdArtifact.entities, term),
      )!,
    );
  }

  const sortColumn = options?.sortBy === "updateDate" ? mdArtifact.updateDate : mdArtifact.artifactDate;
  const orderBy = options?.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const query = db.select().from(mdArtifact).where(and(...conditions)).orderBy(orderBy);
  if (offset !== undefined) {
    return await query.limit(PAGE_SIZE).offset(offset);
  }
  return await query.limit(PAGE_SIZE);
}

export const getMdArtifactByIntegrationArtifactId = async (integrationArtifactId: string, db: SqliteDb): Promise<MdArtifactSelect> => {
  const [record] = await db.select().from(mdArtifact).where(eq(mdArtifact.integrationArtifactId, integrationArtifactId));
  return record!;
}

export const getMdArtifactBetweenDatesAndIntegrationAndEntity = async (
  entity: string,
  startDate?: string,
  endDate?: string,
  integration?: string,
  limit?: number,
  offset?: number,
  db: SqliteDb = defaultDb,
): Promise<MdArtifactSelect[]> => {
  const conditions = [
    like(mdArtifact.entities, `%${entity}%`),
  ];
  if (integration) {
    conditions.push(eq(lower(mdArtifact.integration), integration.toLowerCase()));
  }
  if (startDate) {
    conditions.push(gte(mdArtifact.artifactDate, startDate));
  }
  if (endDate) {
    conditions.push(lte(mdArtifact.artifactDate, endDate));
  }
  const query = db.select().from(mdArtifact).where(and(...conditions));
  if (offset !== undefined) {
    return await query.limit(limit ? limit : PAGE_SIZE).offset(offset);
  }
  return await query.limit(limit ? limit : PAGE_SIZE);
}

export const upsertMdArtifact = async (markdownArtifact: MdArtifactInsert, db: SqliteDb): Promise<void> => {
  const [existing] = await db.select().from(mdArtifact).where(eq(mdArtifact.integrationArtifactId, markdownArtifact.integrationArtifactId));
  if (existing) {
    await db.update(mdArtifact).set({
      integration: markdownArtifact.integration,
      artifactDate: markdownArtifact.artifactDate,
      markdown: markdownArtifact.markdown,
      keyPoints: markdownArtifact.keyPoints,
      questionsAnswered: markdownArtifact.questionsAnswered,
      entities: markdownArtifact.entities,
    }).where(sql`"integrationArtifactId" = ${markdownArtifact.integrationArtifactId}`);
  } else {
    await db.insert(mdArtifact).values(markdownArtifact);
  }
  return;
}

export const deleteMdArtifactById = async (id: string, db: SqliteDb): Promise<void> => {
  await db.delete(mdArtifact).where(sql`"id" = ${id}`);
}

export const deleteMdArtifactsByIntegration = async (integration: string, db: SqliteDb): Promise<void> => {
  await db.delete(mdArtifact).where(sql`LOWER("integration") = ${integration.toLowerCase()}`);
}

export const deleteSyncTasksByIntegration = async (integration: string, db: SqliteDb): Promise<void> => {
  await db.delete(syncTask).where(sql`LOWER("integration") = ${integration.toLowerCase()}`);
}

export const deleteSyncTasksPriorToDate = async (date: string, db: SqliteDb): Promise<void> => {
  await db.delete(syncTask).where(sql`"updateDate" <= ${date}`);
}

export const deleteIntegrationCredentialByIntegration = async (integration: string, db: SqliteDb): Promise<void> => {
  await db.delete(integrationCredential).where(sql`LOWER("integration") = ${integration.toLowerCase()}`);
}

export const getLastArtifactDateByIntegration = async (integration: string, db: SqliteDb): Promise<string | undefined> => {
  const [record] = await db.select({ artifactDate: mdArtifact.artifactDate }).from(mdArtifact).where(eq(lower(mdArtifact.integration), integration.toLowerCase())).orderBy(desc(mdArtifact.artifactDate)).limit(1);
  return record?.artifactDate ?? undefined;
}
