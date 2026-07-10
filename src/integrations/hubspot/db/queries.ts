import { sql } from "drizzle-orm";
import type { SqliteDb } from "@/core/models/db-models";
import {
  hubspotContact,
  type HubspotContactInsert,
  hubspotCompany,
  type HubspotCompanyInsert,
  hubspotDeal,
  type HubspotDealInsert,
} from "./schema";

export const batchInsertHubspotContact = async (rows: HubspotContactInsert[], db: SqliteDb): Promise<void> => {
  if (rows.length === 0) return;
  await db.insert(hubspotContact).values(rows).onConflictDoUpdate({
    target: hubspotContact.hubspotId,
    set: {
      email: sql`excluded.email`,
      firstName: sql`excluded.firstName`,
      lastName: sql`excluded.lastName`,
      phone: sql`excluded.phone`,
      company: sql`excluded.company`,
      jobTitle: sql`excluded.jobTitle`,
      lifecycleStage: sql`excluded.lifecycleStage`,
      properties: sql`excluded.properties`,
      createdAt: sql`excluded.createdAt`,
      updatedAt: sql`excluded.updatedAt`,
      lastModifiedAt: sql`excluded.lastModifiedAt`,
    },
  });
};

export const getLatestHubspotContactModified = async (db: SqliteDb): Promise<string | null> => {
  const [row] = await db.select({ lastModifiedAt: hubspotContact.lastModifiedAt }).from(hubspotContact)
    .orderBy(sql`${hubspotContact.lastModifiedAt} desc`).limit(1);
  return row?.lastModifiedAt ?? null;
};

export const batchInsertHubspotCompany = async (rows: HubspotCompanyInsert[], db: SqliteDb): Promise<void> => {
  if (rows.length === 0) return;
  await db.insert(hubspotCompany).values(rows).onConflictDoUpdate({
    target: hubspotCompany.hubspotId,
    set: {
      name: sql`excluded.name`,
      domain: sql`excluded.domain`,
      industry: sql`excluded.industry`,
      phone: sql`excluded.phone`,
      city: sql`excluded.city`,
      state: sql`excluded.state`,
      country: sql`excluded.country`,
      properties: sql`excluded.properties`,
      createdAt: sql`excluded.createdAt`,
      updatedAt: sql`excluded.updatedAt`,
      lastModifiedAt: sql`excluded.lastModifiedAt`,
    },
  });
};

export const getLatestHubspotCompanyModified = async (db: SqliteDb): Promise<string | null> => {
  const [row] = await db.select({ lastModifiedAt: hubspotCompany.lastModifiedAt }).from(hubspotCompany)
    .orderBy(sql`${hubspotCompany.lastModifiedAt} desc`).limit(1);
  return row?.lastModifiedAt ?? null;
};

export const batchInsertHubspotDeal = async (rows: HubspotDealInsert[], db: SqliteDb): Promise<void> => {
  if (rows.length === 0) return;
  await db.insert(hubspotDeal).values(rows).onConflictDoUpdate({
    target: hubspotDeal.hubspotId,
    set: {
      dealName: sql`excluded.dealName`,
      amount: sql`excluded.amount`,
      dealStage: sql`excluded.dealStage`,
      pipeline: sql`excluded.pipeline`,
      closeDate: sql`excluded.closeDate`,
      properties: sql`excluded.properties`,
      createdAt: sql`excluded.createdAt`,
      updatedAt: sql`excluded.updatedAt`,
      lastModifiedAt: sql`excluded.lastModifiedAt`,
    },
  });
};

export const getLatestHubspotDealModified = async (db: SqliteDb): Promise<string | null> => {
  const [row] = await db.select({ lastModifiedAt: hubspotDeal.lastModifiedAt }).from(hubspotDeal)
    .orderBy(sql`${hubspotDeal.lastModifiedAt} desc`).limit(1);
  return row?.lastModifiedAt ?? null;
};

export const deleteHubspotData = async (db: SqliteDb): Promise<void> => {
  await db.delete(hubspotDeal);
  await db.delete(hubspotCompany);
  await db.delete(hubspotContact);
};
