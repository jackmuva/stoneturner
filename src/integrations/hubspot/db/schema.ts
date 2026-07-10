import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const hubspotContact = sqliteTable("hubspotContact", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  hubspotId: text("hubspotId").unique().notNull(),
  email: text("email"),
  firstName: text("firstName"),
  lastName: text("lastName"),
  phone: text("phone"),
  company: text("company"),
  jobTitle: text("jobTitle"),
  lifecycleStage: text("lifecycleStage"),
  properties: text("properties", { mode: "json" }).$type<Record<string, string | null>>().$defaultFn(() => ({})),
  createdAt: text("createdAt"),
  updatedAt: text("updatedAt"),
  lastModifiedAt: text("lastModifiedAt"),
}, (table) => [
  uniqueIndex("hubspotContact_hubspotId_unique_idx").on(table.hubspotId),
]);

export type HubspotContactSelect = InferSelectModel<typeof hubspotContact>;
export type HubspotContactInsert = InferInsertModel<typeof hubspotContact>;

export const hubspotCompany = sqliteTable("hubspotCompany", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  hubspotId: text("hubspotId").unique().notNull(),
  name: text("name"),
  domain: text("domain"),
  industry: text("industry"),
  phone: text("phone"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  properties: text("properties", { mode: "json" }).$type<Record<string, string | null>>().$defaultFn(() => ({})),
  createdAt: text("createdAt"),
  updatedAt: text("updatedAt"),
  lastModifiedAt: text("lastModifiedAt"),
}, (table) => [
  uniqueIndex("hubspotCompany_hubspotId_unique_idx").on(table.hubspotId),
]);

export type HubspotCompanySelect = InferSelectModel<typeof hubspotCompany>;
export type HubspotCompanyInsert = InferInsertModel<typeof hubspotCompany>;

export const hubspotDeal = sqliteTable("hubspotDeal", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  hubspotId: text("hubspotId").unique().notNull(),
  dealName: text("dealName"),
  amount: text("amount"),
  dealStage: text("dealStage"),
  pipeline: text("pipeline"),
  closeDate: text("closeDate"),
  properties: text("properties", { mode: "json" }).$type<Record<string, string | null>>().$defaultFn(() => ({})),
  createdAt: text("createdAt"),
  updatedAt: text("updatedAt"),
  lastModifiedAt: text("lastModifiedAt"),
}, (table) => [
  uniqueIndex("hubspotDeal_hubspotId_unique_idx").on(table.hubspotId),
]);

export type HubspotDealSelect = InferSelectModel<typeof hubspotDeal>;
export type HubspotDealInsert = InferInsertModel<typeof hubspotDeal>;
