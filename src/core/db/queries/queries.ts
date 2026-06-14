import { type IntegrationCredential, integrationCredential, type SyncTaskInsert, type SyncTaskSelect, syncTask, type MdArtifactSelect, type MdArtifactInsert, mdArtifact } from '@/core/db/schema/schema';
import { and, eq, gte, like, lte, gt } from 'drizzle-orm';
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

export const getSyncTaskByIntegration = async (integration: string): Promise<SyncTaskSelect[] | undefined> => {
  return await db.select().from(syncTask).where(and(eq(syncTask.integration, integration)));
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

export const getFailedSyncTasks = async (): Promise<SyncTaskSelect[] | undefined> => {
  return await db.select().from(syncTask).where(eq(syncTask.status, "FAILED"));
}

export const getPendingSyncTasks = async (): Promise<SyncTaskSelect[] | undefined> => {
  return await db.select().from(syncTask).where(eq(syncTask.status, "PENDING"));
}

export const getSyncTasksByUpdateDateAfter = async (updateDate: string): Promise<SyncTaskSelect[]> => {
  return await db.select().from(syncTask).where(gt(syncTask.updateDate, updateDate));
}

export const getMdArtifactById = async (id: string): Promise<MdArtifactSelect[]> => {
  return await db.select().from(mdArtifact).where(eq(mdArtifact.id, id));
}

export const getMdArtifactByIntegration = async (integration: string, offset?: number): Promise<MdArtifactSelect[]> => {
  const query = db.select().from(mdArtifact).where(eq(mdArtifact.integration, integration));
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
