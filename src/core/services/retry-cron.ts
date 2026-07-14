import { PAGE_SIZE } from "@/lib/constants";
import { getSyncTasksByStatus, incrementSyncTaskRetries } from "../db/queries/queries";
import type { SyncTaskSelect } from "../db/schema/schema";
import type { SqliteDb } from "../models/db-models";
import type { IntegrationStepFn, SyncStepPipeline } from "../models/models";
import { runSyncPipeline } from "./pipeline-runner";
import { supportedIntegrations } from "@/integrations/integration-registry";

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
      const index = supportedIntegrations.findIndex((integ) => integ.config.integration.toLowerCase() === task.integration);
      if (index === -1) return;
      const pipeline: SyncStepPipeline | undefined = supportedIntegrations[index]?.syncPipeline;

      const stepFunc = getStepFn(task.integration, task.step!)!;
      retriedTaskIds.push(task.id);

      try {
        if (stepFunc && pipeline) {
          await stepFunc(true, db, task.inputs, task.id);
          await runSyncPipeline(pipeline, true, db, task.step!);
        }
      } catch (e) {
        console.error(`retry failed for ${task.integration}/${task.step} (${task.id}):`, e);
      }
    }));

    await incrementSyncTaskRetries(retriedTaskIds, db);

    offset += PAGE_SIZE;
    failedTasks = await getSyncTasksByStatus("FAILED", offset, "desc", db);
  }
};


export const getStepFn = (integration: string, step: string): IntegrationStepFn | undefined => {
  const index = supportedIntegrations.findIndex((integ) => integ.config.integration.toLowerCase() === integration);
  if (index === -1) return;
  const pipeline: SyncStepPipeline | undefined = supportedIntegrations[index]?.syncPipeline;
  if (!pipeline) return;

  let stepNum = 0;
  let subStep = 0;

  while (pipeline[stepNum]) {
    if (!pipeline[stepNum]![subStep]) {
      stepNum += 1;
    } else if (Object.keys(pipeline[stepNum]![subStep]!)[0] === step) {
      return Object.values(pipeline[stepNum]![subStep]!)[0];
    } else if (pipeline[stepNum]![subStep + 1]) {
      subStep += 1;
    } else {
      stepNum += 1;
      subStep = 0;
    }
  }
}
