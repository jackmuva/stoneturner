import type { SqliteDb } from "@/core/models/db-models";
import type { HubspotDealInsert } from "../db/schema";
import {
  batchInsertHubspotDeal,
  getLatestHubspotDealModified,
} from "../db/queries";
import {
  HUBSPOT_DEAL_PROPERTIES,
  type HubspotSyncInputs,
  syncHubspotObject,
} from "./hubspot-utils";

const STEP = "hubspot-sync-deals";

const mapDeal = (obj: { id: string; properties: Record<string, string | null>; createdAt: string; updatedAt: string }): HubspotDealInsert => ({
  hubspotId: obj.id,
  dealName: obj.properties.dealname ?? null,
  amount: obj.properties.amount ?? null,
  dealStage: obj.properties.dealstage ?? null,
  pipeline: obj.properties.pipeline ?? null,
  closeDate: obj.properties.closedate ?? null,
  properties: obj.properties,
  createdAt: obj.createdAt,
  updatedAt: obj.updatedAt,
  lastModifiedAt: obj.properties.hs_lastmodifieddate ?? obj.updatedAt,
});

export const syncHubspotDealsStep = async (
  incremental: boolean = false,
  db: SqliteDb,
  inputs?: HubspotSyncInputs,
  syncTaskId?: string,
): Promise<void> => {
  await syncHubspotObject(incremental, db, {
    objectType: "deals",
    step: STEP,
    modifiedProperty: "hs_lastmodifieddate",
    properties: HUBSPOT_DEAL_PROPERTIES,
    getLatestModified: getLatestHubspotDealModified,
    batchInsert: batchInsertHubspotDeal,
    mapRow: mapDeal,
  }, inputs, syncTaskId);
};
