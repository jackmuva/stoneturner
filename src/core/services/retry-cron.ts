import { PAGE_SIZE } from "@/lib/constants";
import { getSyncTasksByStatus, incrementSyncTaskRetries } from "../db/queries/queries";
import type { SyncTaskSelect } from "../db/schema/schema";
import type { SqliteDb } from "../models/db-models";
import { supportedIntegrations } from "@/integrations/integration-registry";
import { getStepFn, runSyncPipeline } from "./pipeline-runner";

const MAX_RETRIES = 3;

const getIntegrationPipeline = (integration: string) =>
  supportedIntegrations.find((integ) => integ.config.integration.toLowerCase() === integration.toLowerCase())?.syncPipeline;

const isRetriable = (task: SyncTaskSelect): boolean => {
  const pipeline = getIntegrationPipeline(task.integration);
  return Boolean(task.step)
    && (task.retries ?? 0) < MAX_RETRIES
    && Boolean(pipeline && getStepFn(pipeline, task.integration, task.step!));
};

export const retryFailedTasks = async (db: SqliteDb) => {
  let offset = 0;
  let failedTasks: SyncTaskSelect[] | undefined = await getSyncTasksByStatus("FAILED", offset, "desc", db);

  while (failedTasks && failedTasks.length > 0) {
    const retriedTaskIds: string[] = [];

    await Promise.allSettled(failedTasks.map(async (task) => {
      if (!isRetriable(task)) return;

      const pipeline = getIntegrationPipeline(task.integration);
      if (!pipeline || !task.step) return;

      const stepFunc = getStepFn(pipeline, task.integration, task.step)!;
      retriedTaskIds.push(task.id);

      try {
        await stepFunc(true, db, task.inputs, task.id);
        await runSyncPipeline(pipeline, true, db, task.step, task.integration);
      } catch (e) {
        console.error(`retry failed for ${task.integration}/${task.step} (${task.id}):`, e);
      }
    }));

    await incrementSyncTaskRetries(retriedTaskIds, db);

    offset += PAGE_SIZE;
    failedTasks = await getSyncTasksByStatus("FAILED", offset, "desc", db);
  }
};
