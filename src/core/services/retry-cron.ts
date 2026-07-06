import { PAGE_SIZE } from "@/lib/constants";
import { getSyncTasksByStatus, incrementSyncTaskRetries } from "../db/queries/queries";
import type { SyncTaskSelect } from "../db/schema/schema";
import type { SqliteDb } from "../models/db-models";
import { getStepFn } from "@/integrations/step-registry";

const MAX_RETRIES = 3;

const isRetriable = (task: SyncTaskSelect): boolean =>
  Boolean(task.step) && (task.retries ?? 0) < MAX_RETRIES && Boolean(getStepFn(task.integration, task.step!));

export const retryFailedTasks = async (db: SqliteDb) => {
  let offset = 0;
  let failedTasks: SyncTaskSelect[] | undefined = await getSyncTasksByStatus("FAILED", offset, "desc", db);

  while (failedTasks && failedTasks.length > 0) {
    const retriedTaskIds: string[] = [];

    await Promise.allSettled(failedTasks.map(async (task) => {
      if (!isRetriable(task)) return;

      const stepFunc = getStepFn(task.integration, task.step!)!;
      retriedTaskIds.push(task.id);

      try {
        await stepFunc(false, db, task.inputs, task.id);
      } catch (e) {
        console.error(`retry failed for ${task.integration}/${task.step} (${task.id}):`, e);
      }
    }));

    await incrementSyncTaskRetries(retriedTaskIds, db);

    offset += PAGE_SIZE;
    failedTasks = await getSyncTasksByStatus("FAILED", offset, "desc", db);
  }
};

