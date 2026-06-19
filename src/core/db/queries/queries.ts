import { type IntegrationCredential, integrationCredential, type SyncTaskInsert, type SyncTaskSelect, syncTask, type MdArtifactSelect, type MdArtifactInsert, mdArtifact } from '@/core/db/schema/schema';
import { and, eq, gte, like, lte, gt, or, asc, desc } from 'drizzle-orm';
import { PAGE_SIZE } from '@/lib/constants';
import { db } from '@/core/db/db';

export const getIntegrationCredentials = async (): Promise<IntegrationCredential[]> => {
  return await db.select().from(integrationCredential);
}

export const getIntegrationCredentialByIntegration = async (integrationName: string): Promise<IntegrationCredential | undefined> => {
  const [record] = await db.select().from(integrationCredential).where(eq(integrationCredential.integration, integrationName));
  return record;
}

export const upsertIntegrationCredential = async (integrationData: IntegrationCredential): Promise<void> => {
  const existing = await getIntegrationCredentialByIntegration(integrationData.integration);
  if (existing) {
    await db.update(integrationCredential).set({
      integrationType: integrationData.integrationType,
      apiKey: integrationData.apiKey,
      accessToken: integrationData.accessToken,
      refreshToken: integrationData.refreshToken,
      accessKey: integrationData.accessKey,
      secretKey: integrationData.secretKey,
      baseUrl: integrationData.baseUrl,
    }).where(eq(integrationCredential.id, existing.id));
  } else {
    await db.insert(integrationCredential).values(integrationData);
  }
}

export const getSyncTasks = async (offset: number = 0, sortOrder: SortOrder = "desc"): Promise<SyncTaskSelect[]> => {
  const orderBy = sortOrder === "asc" ? asc(syncTask.updateDate) : desc(syncTask.updateDate);
  return await db.select().from(syncTask).orderBy(orderBy).offset(offset).limit(PAGE_SIZE);
}

export const getSyncTasksByIntegration = async (integration: string, offset: number = 0, sortOrder: SortOrder = "desc"): Promise<SyncTaskSelect[] | undefined> => {
  const orderBy = sortOrder === "asc" ? asc(syncTask.updateDate) : desc(syncTask.updateDate);
  return await db.select().from(syncTask).where(and(eq(syncTask.integration, integration))).orderBy(orderBy).limit(PAGE_SIZE).offset(offset);
}

export const upsertSyncTask = async (syncTaskData: SyncTaskInsert): Promise<void> => {
  if (syncTaskData.id) {
    const [existing] = await db.select().from(syncTask).where(eq(syncTask.id, syncTaskData.id));
    if (existing) {
      await db.update(syncTask).set({
        integration: syncTaskData.integration,
        updateDate: (new Date()).toISOString(),
        status: syncTaskData.status,
        inputs: syncTaskData.inputs,
      }).where(eq(syncTask.id, existing.id));
      return;
    }
  }
  await db.insert(syncTask).values(syncTaskData);
}

export const getSyncTasksByStatus = async (status: "FAILED" | "PENDING" | "SUCCESS", offset: number = 0, sortOrder: SortOrder = "desc"): Promise<SyncTaskSelect[] | undefined> => {
  const orderBy = sortOrder === "asc" ? asc(syncTask.updateDate) : desc(syncTask.updateDate);
  return await db.select().from(syncTask).where(eq(syncTask.status, status)).orderBy(orderBy).offset(offset).limit(PAGE_SIZE);
}

export const getSyncTasksFiltered = async (filters: {
  integration?: string;
  status?: "FAILED" | "PENDING" | "SUCCESS";
  step?: string;
  offset?: number;
  sortOrder?: SortOrder;
}): Promise<SyncTaskSelect[]> => {
  const { integration, status, step, offset = 0, sortOrder = "desc" } = filters;
  const conditions = [
    integration ? eq(syncTask.integration, integration) : undefined,
    status ? eq(syncTask.status, status) : undefined,
    step ? eq(syncTask.step, step) : undefined,
  ].filter(Boolean);
  const orderBy = sortOrder === "asc" ? asc(syncTask.updateDate) : desc(syncTask.updateDate);
  return await db.select().from(syncTask)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(orderBy).offset(offset).limit(PAGE_SIZE);
}

export const getDistinctSyncTaskSteps = async (): Promise<string[]> => {
  const rows = await db.selectDistinct({ step: syncTask.step }).from(syncTask).orderBy(asc(syncTask.step));
  return rows.map((r) => r.step).filter((s): s is string => s !== null);
}

export const getSyncTasksByUpdateDateAfter = async (updateDate: string): Promise<SyncTaskSelect[]> => {
  return await db.select().from(syncTask).where(gt(syncTask.updateDate, updateDate));
}

export const getMdArtifactById = async (id: string): Promise<MdArtifactSelect[]> => {
  return await db.select().from(mdArtifact).where(eq(mdArtifact.id, id));
}

export type MdArtifactSortField = "updateDate" | "artifactDate";
export type SortOrder = "asc" | "desc";

export const getMdArtifactsByIntegration = async (
  integration: string,
  offset: number = 0,
  options?: {
    search?: string,
    sortBy?: MdArtifactSortField,
    sortOrder?: SortOrder,
  }): Promise<MdArtifactSelect[]> => {
  const conditions = [eq(mdArtifact.integration, integration)];
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

export const getMdArtifactByIntegrationArtifactId = async (integrationArtifactId: string): Promise<MdArtifactSelect> => {
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
): Promise<MdArtifactSelect[]> => {
  const conditions = [
    like(mdArtifact.entities, `%${entity}%`),
  ];
  if (integration) {
    conditions.push(eq(mdArtifact.integration, integration));
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

export const upsertMdArtifact = async (markdownArtifact: MdArtifactInsert): Promise<void> => {
  const [existing] = await db.select().from(mdArtifact).where(eq(mdArtifact.integrationArtifactId, markdownArtifact.integrationArtifactId));
  if (existing) {
    await db.update(mdArtifact).set({
      integration: markdownArtifact.integration,
      artifactDate: markdownArtifact.artifactDate,
      markdown: markdownArtifact.markdown,
      keyPoints: markdownArtifact.keyPoints,
      questionsAnswered: markdownArtifact.questionsAnswered,
      entities: markdownArtifact.entities,
      lastIndex: markdownArtifact.lastIndex,
    }).where(eq(mdArtifact.integrationArtifactId, markdownArtifact.integrationArtifactId));
  } else {
    await db.insert(mdArtifact).values(markdownArtifact);
  }
  return;
}

export const deleteMdArtifactById = async (id: string): Promise<void> => {
  await db.delete(mdArtifact).where(eq(mdArtifact.id, id));
}

export const deleteMdArtifactsByIntegration = async (integration: string): Promise<void> => {
  await db.delete(mdArtifact).where(eq(mdArtifact.integration, integration));
}

export const deleteSyncTasksByIntegration = async (integration: string): Promise<void> => {
  await db.delete(syncTask).where(eq(syncTask.integration, integration));
}

export const deleteIntegrationCredentialByIntegration = async (integration: string): Promise<void> => {
  await db.delete(integrationCredential).where(eq(integrationCredential.integration, integration));
}
