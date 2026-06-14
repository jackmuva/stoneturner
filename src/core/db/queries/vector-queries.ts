import { db } from '@/core/db/db';
import {
  contentEmbedding,
  keyPointsEmbedding,
  questionsAnsweredEmbedding,
  type ContentEmbeddingInsert,
  type KeyPointsEmbeddingInsert,
  type QuestionsAnsweredEmbeddingInsert,
} from '../schema/vector-schema';
import { sql } from 'drizzle-orm';

export const upsertContentEmbedding = async (
  row: Omit<ContentEmbeddingInsert, 'embedding'> & { embedding: number[] },
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

export const searchContentEmbeddingByCosine = async (
  queryEmbedding: number[],
  limit: number = 5,
) => {
  const distance = sql<number>`vector_distance_cos(${contentEmbedding.embedding}, vector32(${JSON.stringify(queryEmbedding)}))`;
  return await db
    .select({
      integrationArtifactId: contentEmbedding.integrationArtifactId,
      content: contentEmbedding.content,
      distance,
    })
    .from(contentEmbedding)
    .orderBy(distance)
    .limit(limit);
};

export const upsertKeyPointsEmbedding = async (
  row: Omit<KeyPointsEmbeddingInsert, 'embedding'> & { embedding: number[] },
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
) => {
  const distance = sql<number>`vector_distance_cos(${keyPointsEmbedding.embedding}, vector32(${JSON.stringify(queryEmbedding)}))`;
  return await db
    .select({
      integrationArtifactId: keyPointsEmbedding.integrationArtifactId,
      content: keyPointsEmbedding.content,
      distance,
    })
    .from(keyPointsEmbedding)
    .orderBy(distance)
    .limit(limit);
};

export const upsertQuestionsAnsweredEmbedding = async (
  row: Omit<QuestionsAnsweredEmbeddingInsert, 'embedding'> & { embedding: number[] },
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
) => {
  const distance = sql<number>`vector_distance_cos(${questionsAnsweredEmbedding.embedding}, vector32(${JSON.stringify(queryEmbedding)}))`;
  return await db
    .select({
      integrationArtifactId: questionsAnsweredEmbedding.integrationArtifactId,
      content: questionsAnsweredEmbedding.content,
      distance,
    })
    .from(questionsAnsweredEmbedding)
    .orderBy(distance)
    .limit(limit);
};
