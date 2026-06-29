import type { SqliteDb } from '@/core/models/db-models';
import { db as defaultDb } from '@/core/db/db';
import {
  contentEmbedding,
  keyPointsEmbedding,
  questionsAnsweredEmbedding,
  type ContentEmbeddingInsert,
  type ContentEmbeddingSelect,
  type KeyPointsEmbeddingInsert,
  type QuestionsAnsweredEmbeddingInsert,
} from '../schema/vector-schema';
import { and, eq, gte, lte, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { lower } from '@/lib/utils';

export type EmbeddingSearchFilters = {
  integration?: string;
  minDate?: string;
  maxDate?: string;
  entities?: string[];
};

type FilterColumns = {
  integration: SQLiteColumn;
  artifactDate: SQLiteColumn;
  entities: SQLiteColumn;
};

const buildFilterConditions = (
  columns: FilterColumns,
  filters?: EmbeddingSearchFilters,
): SQL | undefined => {
  if (!filters) return undefined;
  const conditions: SQLWrapper[] = [];
  if (filters.integration !== undefined) {
    conditions.push(eq(lower(columns.integration), filters.integration.toLowerCase()));
  }
  if (filters.minDate !== undefined) {
    conditions.push(gte(columns.artifactDate, filters.minDate));
  }
  if (filters.maxDate !== undefined) {
    conditions.push(lte(columns.artifactDate, filters.maxDate));
  }
  if (filters.entities !== undefined) {
    for (const entity of filters.entities) {
      conditions.push(sql`array_contains(${columns.entities}, ${entity}) = 1`);
    }
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
};

export const upsertContentEmbedding = async (
  row: Omit<ContentEmbeddingInsert, 'embedding'> & { embedding: number[] },
  db: SqliteDb,
): Promise<void> => {
  const { embedding, ...rest } = row;
  const values = {
    ...rest,
    embedding: sql`vector32(${JSON.stringify(embedding)})`,
  };
  await db.insert(contentEmbedding).values(values).onConflictDoUpdate({
    target: contentEmbedding.id,
    set: {
      integration: values.integration,
      updateDate: (new Date()).toISOString(),
      artifactDate: values.artifactDate,
      content: values.content,
      entities: values.entities,
      embedding: values.embedding,
    },
  });
};

export const getEmbeddingsByIntegrationArtifactId = async (artifactId: string, db: SqliteDb): Promise<ContentEmbeddingSelect[]> => {
  return await db.select().from(contentEmbedding).where(eq(contentEmbedding.integrationArtifactId, artifactId));
}

export const searchContentEmbeddingByCosine = async (
  queryEmbedding: number[],
  limit: number = 5,
  filters?: EmbeddingSearchFilters,
  db: SqliteDb = defaultDb,
) => {
  const distance = sql<number>`vector_distance_cos(${contentEmbedding.embedding}, vector32(${JSON.stringify(queryEmbedding)}))`;
  return await db
    .select({
      integrationArtifactId: contentEmbedding.integrationArtifactId,
      content: contentEmbedding.content,
      distance,
    })
    .from(contentEmbedding)
    .where(buildFilterConditions(
      {
        integration: contentEmbedding.integration,
        artifactDate: contentEmbedding.artifactDate,
        entities: contentEmbedding.entities,
      },
      filters,
    ))
    .orderBy(distance)
    .limit(limit);
};

export const upsertKeyPointsEmbedding = async (
  row: Omit<KeyPointsEmbeddingInsert, 'embedding'> & { embedding: number[] },
  db: SqliteDb,
): Promise<void> => {
  const { embedding, ...rest } = row;
  const values = {
    ...rest,
    embedding: sql`vector32(${JSON.stringify(embedding)})`,
  };
  await db.insert(keyPointsEmbedding).values(values).onConflictDoUpdate({
    target: keyPointsEmbedding.id,
    set: {
      integration: values.integration,
      updateDate: (new Date()).toISOString(),
      artifactDate: values.artifactDate,
      content: values.content,
      entities: values.entities,
      embedding: values.embedding,
    },
  });
};

export const searchKeyPointsEmbeddingByCosine = async (
  queryEmbedding: number[],
  limit: number = 5,
  filters?: EmbeddingSearchFilters,
  db: SqliteDb = defaultDb,
) => {
  const distance = sql<number>`vector_distance_cos(${keyPointsEmbedding.embedding}, vector32(${JSON.stringify(queryEmbedding)}))`;
  return await db
    .select({
      integrationArtifactId: keyPointsEmbedding.integrationArtifactId,
      content: keyPointsEmbedding.content,
      distance,
    })
    .from(keyPointsEmbedding)
    .where(buildFilterConditions(
      {
        integration: keyPointsEmbedding.integration,
        artifactDate: keyPointsEmbedding.artifactDate,
        entities: keyPointsEmbedding.entities,
      },
      filters,
    ))
    .orderBy(distance)
    .limit(limit);
};

export const upsertQuestionsAnsweredEmbedding = async (
  row: Omit<QuestionsAnsweredEmbeddingInsert, 'embedding'> & { embedding: number[] },
  db: SqliteDb,
): Promise<void> => {
  const { embedding, ...rest } = row;
  const values = {
    ...rest,
    embedding: sql`vector32(${JSON.stringify(embedding)})`,
  };
  await db.insert(questionsAnsweredEmbedding).values(values).onConflictDoUpdate({
    target: questionsAnsweredEmbedding.id,
    set: {
      integration: values.integration,
      updateDate: (new Date()).toISOString(),
      artifactDate: values.artifactDate,
      content: values.content,
      entities: values.entities,
      embedding: values.embedding,
    },
  });
};

export const searchQuestionsAnsweredEmbeddingByCosine = async (
  queryEmbedding: number[],
  limit: number = 5,
  filters?: EmbeddingSearchFilters,
  db: SqliteDb = defaultDb,
) => {
  const distance = sql<number>`vector_distance_cos(${questionsAnsweredEmbedding.embedding}, vector32(${JSON.stringify(queryEmbedding)}))`;
  return await db
    .select({
      integrationArtifactId: questionsAnsweredEmbedding.integrationArtifactId,
      content: questionsAnsweredEmbedding.content,
      distance,
    })
    .from(questionsAnsweredEmbedding)
    .where(buildFilterConditions(
      {
        integration: questionsAnsweredEmbedding.integration,
        artifactDate: questionsAnsweredEmbedding.artifactDate,
        entities: questionsAnsweredEmbedding.entities,
      },
      filters,
    ))
    .orderBy(distance)
    .limit(limit);
};

export const deleteEmbeddingByIntegration = async (integration: string, db: SqliteDb): Promise<void> => {
  await db.delete(contentEmbedding).where(sql`LOWER("integration") = ${integration.toLowerCase()}`);
  await db.delete(keyPointsEmbedding).where(sql`LOWER("integration") = ${integration.toLowerCase()}`);
  await db.delete(questionsAnsweredEmbedding).where(sql`LOWER("integration") = ${integration.toLowerCase()}`);
};

export const deleteEmbeddingsByIntegrationArtifactId = async (integrationArtifactId: string, db: SqliteDb): Promise<void> => {
  await db.delete(contentEmbedding).where(sql`"integrationArtifactId" = ${integrationArtifactId}`);
  await db.delete(keyPointsEmbedding).where(sql`"integrationArtifactId" = ${integrationArtifactId}`);
  await db.delete(questionsAnsweredEmbedding).where(sql`"integrationArtifactId" = ${integrationArtifactId}`);
};
