import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { sqliteTable, text, blob } from "drizzle-orm/sqlite-core";

export const contentEmbedding = sqliteTable("contentEmbedding", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  integrationArtifactId: text("integrationArtifactId").notNull(),
  integration: text("integration").notNull(),
  updateDate: text("updateDate").notNull().$defaultFn(() => (new Date()).toISOString()),
  artifactDate: text("artifactDate"),
  content: text("content"),
  entities: text("entities", { mode: "json" }).$type<Array<string>>(),
  embedding: blob("embedding")
});

export type ContentEmbeddingSelect = InferSelectModel<typeof contentEmbedding>;
export type ContentEmbeddingInsert = InferInsertModel<typeof contentEmbedding>;

export const keyPointsEmbedding = sqliteTable("keyPointsEmbedding", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  integrationArtifactId: text("integrationArtifactId").notNull(),
  integration: text("integration").notNull(),
  updateDate: text("updateDate").notNull().$defaultFn(() => (new Date()).toISOString()),
  artifactDate: text("artifactDate"),
  content: text("content"),
  entities: text("entities", { mode: "json" }).$type<Array<string>>(),
  embedding: blob("embedding")
});

export type KeyPointsEmbeddingSelect = InferSelectModel<typeof keyPointsEmbedding>;
export type KeyPointsEmbeddingInsert = InferInsertModel<typeof keyPointsEmbedding>;

export const questionsAnsweredEmbedding = sqliteTable("questionsAnsweredEmbedding", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  integrationArtifactId: text("integrationArtifactId").notNull(),
  integration: text("integration").notNull(),
  updateDate: text("updateDate").notNull().$defaultFn(() => (new Date()).toISOString()),
  artifactDate: text("artifactDate"),
  content: text("content"),
  entities: text("entities", { mode: "json" }).$type<Array<string>>(),
  embedding: blob("embedding")
});

export type QuestionsAnsweredEmbeddingSelect = InferSelectModel<typeof questionsAnsweredEmbedding>;
export type QuestionsAnsweredEmbeddingInsert = InferInsertModel<typeof questionsAnsweredEmbedding>;
