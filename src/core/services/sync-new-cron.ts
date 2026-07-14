import { supportedIntegrations } from "@/integrations/integration-registry";
import { getAllSyncPipelines, updateSyncPipelineStatus, upsertSyncPipeline } from "../db/queries/queries"
import type { SqliteDb } from "../models/db-models"
import { runSyncPipeline } from "./pipeline-runner";

export const syncNewCron = async (db: SqliteDb) => {
  const pipelines = await getAllSyncPipelines(db);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  for (const sched of pipelines) {
    const nextDate = new Date(sched.updateDate);
    if (sched.frequency === "DAILY") {
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (sched.frequency === "WEEKLY") {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (sched.frequency === "MONTHLY") {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }

    if (today > nextDate) {
      const index = supportedIntegrations.findIndex((integ) => integ.config.integration.toLowerCase() === sched.integration);
      if (index === -1) continue;
      await updateSyncPipelineStatus(sched.integration, "SYNCING", db);
      Promise.resolve(runSyncPipeline(supportedIntegrations[index]!.syncPipeline, true, db))
        .finally(() => updateSyncPipelineStatus(sched.integration, "IDLE", db));
      await upsertSyncPipeline({
        integration: sched.integration,
        frequency: sched.frequency,
      }, db)
    }
  }
}
