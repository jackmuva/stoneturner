import type { Integration } from "@/core/models/models";
import type { SqliteDb } from "@/core/models/db-models";
import { deleteSourceContextByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { hubspotConfig } from "./config";
import { deleteHubspotData } from "./db/queries";
import { handleHubspotRefresh, handleOauthRedirect } from "./sync-steps/hubspot-utils";
import { hubspotPipeline } from "./pipeline";

export const hubspotIntegration: Integration = {
  config: hubspotConfig,
  syncPipeline: hubspotPipeline,
  deleteSync: async (db: SqliteDb) => {
    await deleteSyncTasksByIntegration("hubspot", db);
    await deleteSourceContextByIntegration("hubspot", db);
    await deleteHubspotData(db);
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: handleHubspotRefresh,
};
