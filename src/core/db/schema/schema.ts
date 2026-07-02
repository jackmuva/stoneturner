import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const integrationCredential = sqliteTable("integrationCredential", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  integration: text("integration").notNull(),
  integrationType: text("integrationType").notNull(),
  apiKey: text("apiKey"),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  accessKey: text("accessKey"),
  secretKey: text("secretKey"),
  baseUrl: text("baseUrl"),
  tokenExpiration: text("tokenExpiration"),
  options: text("options", { mode: "json" }).$type<Record<string, string>>()
});

export type IntegrationCredential = InferSelectModel<typeof integrationCredential>;
export type IntegrationCredentialInsert = InferInsertModel<typeof integrationCredential>;

export const syncTask = sqliteTable("syncTask", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  integration: text("integration").notNull(),
  updateDate: text("updateDate").notNull().$defaultFn(() => (new Date()).toISOString()),
  status: text("status").$type<"SUCCESS" | "FAILED" | "PENDING">(),
  inputs: text("inputs", { mode: "json" }),
  step: text("step"),
},);

export type SyncTaskSelect = InferSelectModel<typeof syncTask>;
export type SyncTaskInsert = InferInsertModel<typeof syncTask>;

export const mdArtifact = sqliteTable("mdArtifacts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  integrationArtifactId: text("integrationArtifactId").unique().notNull(),
  integration: text("integration").notNull(),
  updateDate: text("updateDate").notNull().$defaultFn(() => (new Date()).toISOString()),
  artifactDate: text("artifactDate"),
  markdown: text("markdown"),
  keyPoints: text("keyPoints", { mode: "json" }).$type<Array<string>>(),
  questionsAnswered: text("questionsAnswered", { mode: "json" }).$type<Array<string>>(),
  entities: text("entities", { mode: "json" }).$type<Array<string>>(),
}, (table) => ({
  integrationDateIdx: index("idx_md_artifacts_integration_date").on(table.integration, table.artifactDate),
}));


export type MdArtifactSelect = InferSelectModel<typeof mdArtifact>;
export type MdArtifactInsert = InferInsertModel<typeof mdArtifact>;
