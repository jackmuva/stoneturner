import { type IntegrationCredential, integrationCredential, type SyncTaskInsert, type SyncTaskSelect, syncTask, type MdArtifactSelect, type MdArtifactInsert, mdArtifact, type IntegrationCredentialInsert, syncPipeline, type SyncPipelineInsert, type SyncPipelineSelect, sourceContext, type SourceContextInsert, type SourceContextSelect } from '@/core/db/schema/schema';
import { and, eq, like, or, asc, desc, sql } from 'drizzle-orm';
import { PAGE_SIZE } from '@/lib/constants';
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
  integrationData.integration = integrationData.integration.toLowerCase();
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
        error: syncTaskData.error,
        step: syncTaskData.step,
        retries: syncTaskData.retries ?? existing.retries,
      }).where(sql`"id" = ${existing.id}`);
      return;
    }
  }
  await db.insert(syncTask).values(syncTaskData);
}

export const incrementSyncTaskRetries = async (ids: string[], db: SqliteDb): Promise<void> => {
  if (ids.length === 0) return;
  const idList = sql.join(ids.map((id) => sql`${id}`), sql`, `);
  await db.update(syncTask).set({
    retries: sql`"retries" + 1`,
    updateDate: (new Date()).toISOString(),
  }).where(sql`"id" in (${idList})`);
}

export const batchUpsertSyncTask = async (tasks: SyncTaskInsert[], db: SqliteDb): Promise<void> => {
  await db.insert(syncTask)
    .values(tasks)
    .onConflictDoUpdate({
      target: syncTask.id,
      set: {
        integration: sql`excluded.integration`,
        updateDate: sql`excluded.updateDate`,
        status: sql`excluded.status`,
        inputs: sql`excluded.inputs`,
        error: sql`excluded.error`,
        step: sql`excluded.step`,
        retries: sql`excluded.retries`,
      }
    });
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
  const conditions = [eq(mdArtifact.integration, integration.toLowerCase())];
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

  const query = db.select({
    id: mdArtifact.id,
    integrationArtifactId: mdArtifact.integrationArtifactId,
    integration: mdArtifact.integration,
    updateDate: mdArtifact.updateDate,
    artifactDate: mdArtifact.artifactDate,
    markdown: sql<string | null>`substr(${mdArtifact.markdown}, 1, 500)`.as("markdown"),
    keyPoints: mdArtifact.keyPoints,
    questionsAnswered: mdArtifact.questionsAnswered,
    entities: mdArtifact.entities,
  }).from(mdArtifact).where(and(...conditions)).orderBy(orderBy);
  if (offset !== undefined) {
    return await query.limit(PAGE_SIZE).offset(offset);
  }
  return await query.limit(PAGE_SIZE);
}

export const getMostRecentMdArtifactsByIntegration = async (
  db: SqliteDb,
  integration: string,
  limit: number = 5,
): Promise<MdArtifactSelect[]> => {
  return await db.select().from(mdArtifact)
    .where(eq(mdArtifact.integration, integration.toLowerCase()))
    .orderBy(desc(mdArtifact.artifactDate))
    .limit(limit);
}

export const getMdArtifactByIntegrationArtifactId = async (integrationArtifactId: string, db: SqliteDb): Promise<MdArtifactSelect> => {
  const [record] = await db.select().from(mdArtifact).where(eq(mdArtifact.integrationArtifactId, integrationArtifactId));
  return record!;
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

export const getAllSyncPipelines = async (db: SqliteDb): Promise<SyncPipelineSelect[]> => {
  return await db.select().from(syncPipeline);
}

export const getSyncPipelineByIntegration = async (integration: string, db: SqliteDb): Promise<SyncPipelineSelect | undefined> => {
  const [pipeline] = await db.select().from(syncPipeline).where(sql`LOWER("integration") = ${integration.toLowerCase()}`);
  return pipeline;
}

export const deleteSyncPipelineByIntegration = async (integration: string, db: SqliteDb): Promise<void> => {
  await db.delete(syncPipeline).where(sql`LOWER("integration") = ${integration.toLowerCase()}`);
}

export const updateSyncPipelineStatus = async (integration: string, status: "IDLE" | "SYNCING", db: SqliteDb): Promise<void> => {
  const [existing] = await db.select().from(syncPipeline).where(sql`LOWER("integration") = ${integration}`);
  if (existing) {
    await db.update(syncPipeline).set({
      status,
      updateDate: (new Date()).toISOString(),
    }).where(sql`LOWER("integration") = ${integration.toLowerCase()}`);
  } else {
    await db.insert(syncPipeline).values({ integration, status });
  }
}

export const upsertSyncPipeline = async (data: SyncPipelineInsert, db: SqliteDb): Promise<void> => {
  const integration = data.integration.toLowerCase();
  const [existing] = await db.select().from(syncPipeline).where(sql`LOWER("integration") = ${integration}`);
  if (existing) {
    await db.update(syncPipeline).set({
      frequency: data.frequency,
      updateDate: (new Date()).toISOString(),
    }).where(sql`LOWER("integration") = ${integration}`);
  } else {
    await db.insert(syncPipeline).values({ ...data, integration });
  }
}

export const getAllSourceContext = async (db: SqliteDb): Promise<SourceContextSelect[]> => {
  return await db.select().from(sourceContext);
}

export const getSourceContextByIntegration = async (integration: string, db: SqliteDb): Promise<SourceContextSelect | undefined> => {
  const [record] = await db.select().from(sourceContext).where(sql`LOWER("integration") = ${integration.toLowerCase()}`);
  return record;
}

export const upsertSourceContext = async (data: SourceContextInsert, db: SqliteDb): Promise<void> => {
  const integration = data.integration.toLowerCase();
  const [existing] = await db.select().from(sourceContext).where(sql`LOWER("integration") = ${integration}`);
  if (existing) {
    await db.update(sourceContext).set({
      context: data.context,
      updateDate: (new Date()).toISOString(),
    }).where(sql`LOWER("integration") = ${integration}`);
  } else {
    await db.insert(sourceContext).values({ ...data, integration });
  }
}

export const deleteSourceContextByIntegration = async (integration: string, db: SqliteDb): Promise<void> => {
  await db.delete(sourceContext).where(sql`LOWER("integration") = ${integration.toLowerCase()}`);
}
