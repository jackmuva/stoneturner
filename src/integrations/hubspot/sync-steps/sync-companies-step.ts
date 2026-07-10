import type { SqliteDb } from "@/core/models/db-models";
import type { HubspotCompanyInsert } from "../db/schema";
import {
  batchInsertHubspotCompany,
  getLatestHubspotCompanyModified,
} from "../db/queries";
import {
  HUBSPOT_COMPANY_PROPERTIES,
  type HubspotSyncInputs,
  syncHubspotObject,
} from "./hubspot-utils";

const STEP = "hubspot-sync-companies";

const mapCompany = (obj: { id: string; properties: Record<string, string | null>; createdAt: string; updatedAt: string }): HubspotCompanyInsert => ({
  hubspotId: obj.id,
  name: obj.properties.name ?? null,
  domain: obj.properties.domain ?? null,
  industry: obj.properties.industry ?? null,
  phone: obj.properties.phone ?? null,
  city: obj.properties.city ?? null,
  state: obj.properties.state ?? null,
  country: obj.properties.country ?? null,
  properties: obj.properties,
  createdAt: obj.createdAt,
  updatedAt: obj.updatedAt,
  lastModifiedAt: obj.properties.hs_lastmodifieddate ?? obj.updatedAt,
});

export const syncHubspotCompaniesStep = async (
  incremental: boolean = false,
  db: SqliteDb,
  inputs?: HubspotSyncInputs,
  syncTaskId?: string,
): Promise<void> => {
  await syncHubspotObject(incremental, db, {
    objectType: "companies",
    step: STEP,
    modifiedProperty: "hs_lastmodifieddate",
    properties: HUBSPOT_COMPANY_PROPERTIES,
    getLatestModified: getLatestHubspotCompanyModified,
    batchInsert: batchInsertHubspotCompany,
    mapRow: mapCompany,
  }, inputs, syncTaskId);
};
