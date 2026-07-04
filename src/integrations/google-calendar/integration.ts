import type { Integration } from "@/core/models/models";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { googleCalendarConfig } from "./config";
import { deleteGoogleCalendarData } from "./db/queries";
import { syncGoogleCalendarsStep } from "./sync-steps/sync-calendars-step";
import { syncGoogleCalendarEventsStep } from "./sync-steps/sync-events-step";
import { parseGoogleCalendarStep } from "./sync-steps/parse-step";
import { handleOauthRedirect, handleGoogleCalendarRefresh } from "./sync-steps/google-calendar-utils";
import type { SqliteDb } from "@/core/models/db-models";

export const syncGoogleCalendarPipeline = async (incremental: boolean = false, db: SqliteDb) => {
  await syncGoogleCalendarsStep(incremental, db);
  await syncGoogleCalendarEventsStep(incremental, db);
  await parseGoogleCalendarStep(db);
  await indexVectorDbStep("google-calendar", incremental, db);
};

export const googleCalendarIntegration: Integration = {
  config: googleCalendarConfig,
  sync: async (db: SqliteDb) => await syncGoogleCalendarPipeline(false, db),
  syncUpdates: async (db: SqliteDb) => await syncGoogleCalendarPipeline(true, db),
  deleteSync: async (db: SqliteDb) => {
    await deleteSyncTasksByIntegration("google-calendar", db);
    await deleteMdArtifactsByIntegration("google-calendar", db);
    await deleteEmbeddingByIntegration("google-calendar", db);
    await deleteGoogleCalendarData(db);
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: handleGoogleCalendarRefresh,
};
