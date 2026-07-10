import type { SqliteDb } from "@/core/models/db-models";
import type { HubspotContactInsert } from "../db/schema";
import {
  batchInsertHubspotContact,
  getLatestHubspotContactModified,
} from "../db/queries";
import {
  HUBSPOT_CONTACT_PROPERTIES,
  type HubspotSyncInputs,
  syncHubspotObject,
} from "./hubspot-utils";

const STEP = "hubspot-sync-contacts";

const mapContact = (obj: { id: string; properties: Record<string, string | null>; createdAt: string; updatedAt: string }): HubspotContactInsert => ({
  hubspotId: obj.id,
  email: obj.properties.email ?? null,
  firstName: obj.properties.firstname ?? null,
  lastName: obj.properties.lastname ?? null,
  phone: obj.properties.phone ?? null,
  company: obj.properties.company ?? null,
  jobTitle: obj.properties.jobtitle ?? null,
  lifecycleStage: obj.properties.lifecyclestage ?? null,
  properties: obj.properties,
  createdAt: obj.createdAt,
  updatedAt: obj.updatedAt,
  lastModifiedAt: obj.properties.lastmodifieddate ?? obj.updatedAt,
});

export const syncHubspotContactsStep = async (
  incremental: boolean = false,
  db: SqliteDb,
  inputs?: HubspotSyncInputs,
  syncTaskId?: string,
): Promise<void> => {
  await syncHubspotObject(incremental, db, {
    objectType: "contacts",
    step: STEP,
    modifiedProperty: "lastmodifieddate",
    properties: HUBSPOT_CONTACT_PROPERTIES,
    getLatestModified: getLatestHubspotContactModified,
    batchInsert: batchInsertHubspotContact,
    mapRow: mapContact,
  }, inputs, syncTaskId);
};
