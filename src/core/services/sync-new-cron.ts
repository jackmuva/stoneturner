import { supportedIntegrations } from "@/integrations/integration-registry";
import { getAllSyncSchedules } from "../db/queries/queries"
import type { SqliteDb } from "../models/db-models"

export const syncNewCron = async (db: SqliteDb) => {
  const schedules = await getAllSyncSchedules(db);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  for (const sched of schedules) {
    const nextDate = new Date(sched.updateDate);
    if (sched.frequency === "DAILY") {
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (sched.frequency === "WEEKLY") {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (sched.frequency === "MONTHLY") {
      nextDate.setDate(nextDate.getDate() + 30);
    }

    if (today > nextDate) {
      const index = supportedIntegrations.findIndex((integ) => integ.config.integration.toLowerCase() === sched.integration);
      if (index === -1) continue;
      supportedIntegrations[index]!.syncUpdates(db);
    }
  }
}
