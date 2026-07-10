import type { Integration } from "@/core/models/models";
import type { SqliteDb } from "@/core/models/db-models";
import { agentExploreContextStep } from "@/core/services/agent-explore-context-step";
import { deleteSourceContextByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { hubspotConfig } from "./config";
import { deleteHubspotData } from "./db/queries";
import { handleHubspotRefresh, handleOauthRedirect } from "./sync-steps/hubspot-utils";
import { syncHubspotContactsStep } from "./sync-steps/sync-contacts-step";
import { syncHubspotCompaniesStep } from "./sync-steps/sync-companies-step";
import { syncHubspotDealsStep } from "./sync-steps/sync-deals-step";

export const syncHubspotPipeline = async (incremental: boolean = false, db: SqliteDb) => {
  await Promise.all([
    syncHubspotContactsStep(incremental, db),
    syncHubspotCompaniesStep(incremental, db),
    syncHubspotDealsStep(incremental, db),
  ]);
  await agentExploreContextStep(incremental, db, { integration: "hubspot" });
};

export const hubspotIntegration: Integration = {
  config: hubspotConfig,
  sync: async (db: SqliteDb) => await syncHubspotPipeline(false, db),
  syncUpdates: async (db: SqliteDb) => await syncHubspotPipeline(true, db),
  deleteSync: async (db: SqliteDb) => {
    await deleteSyncTasksByIntegration("hubspot", db);
    await deleteSourceContextByIntegration("hubspot", db);
    await deleteHubspotData(db);
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: handleHubspotRefresh,
};
