import { PAGE_SIZE } from "@/lib/constants";
import { getSyncTasksByStatus, incrementSyncTaskRetries, updateSyncPipelineStatus } from "../db/queries/queries";
import type { SyncTaskSelect } from "../db/schema/schema";
import type { SqliteDb } from "../models/db-models";
import { supportedIntegrations } from "@/integrations/integration-registry";
import { findPipelineStartStep, getStepFn, runSyncPipeline } from "./pipeline-runner";
import type { SyncStepPipeline } from "../models/models";

const MAX_RETRIES = 3;

const getIntegrationPipeline = (integration: string) =>
  supportedIntegrations.find((integ) => integ.config.integration.toLowerCase() === integration.toLowerCase())?.syncPipeline;

const isRetriable = (task: SyncTaskSelect): boolean => {
  const pipeline = getIntegrationPipeline(task.integration);
  return Boolean(task.step)
    && (task.retries ?? 0) < MAX_RETRIES
    && Boolean(pipeline && getStepFn(pipeline, task.step!));
};

const findLowestStep = (pipeline: SyncStepPipeline, steps: string[]): string => {
  let lowestNum: null | number = null;
  let lowestStep: null | string = null;
  for (const step of steps) {
    const stepNum = findPipelineStartStep(pipeline, step);
    if (!lowestNum || lowestNum > stepNum) {
      lowestNum = stepNum;
      lowestStep = step;
    }
  }
  return lowestStep!;
}

export const retryFailedTasks = async (db: SqliteDb) => {
  let offset = 0;
  let failedTasks: SyncTaskSelect[] | undefined = await getSyncTasksByStatus("FAILED", offset, "desc", db);
  const integrationPipelines: { [integration: string]: string[] } = {};

  while (failedTasks && failedTasks.length > 0) {
    const retriedTaskIds: string[] = [];

    await Promise.allSettled(failedTasks.map(async (task) => {
      if (!isRetriable(task)) return;

      const pipeline = getIntegrationPipeline(task.integration);
      if (!pipeline || !task.step) return;

      const stepFunc = getStepFn(pipeline, task.step)!;
      retriedTaskIds.push(task.id);

      try {
        await stepFunc(true, db, task.inputs, task.id);

      } catch (e) {
        console.error(`retry failed for ${task.integration}/${task.step} (${task.id}):`, e);
      }
    }));

    for (const task of failedTasks) {
      if(!task.step) continue;
      if (task.integration in integrationPipelines) {
        integrationPipelines[task.integration]!.push(task.step);
      } else {
        integrationPipelines[task.integration] = [task.step];
      }
    }

    await incrementSyncTaskRetries(retriedTaskIds, db);

    offset += PAGE_SIZE;
    failedTasks = await getSyncTasksByStatus("FAILED", offset, "desc", db);
  }

  for (const integration of Object.keys(integrationPipelines)) {
    const pipeline = getIntegrationPipeline(integration);
    await updateSyncPipelineStatus(integration, "SYNCING", db);
    Promise.resolve(runSyncPipeline(pipeline!, true, db, findLowestStep(pipeline!, integrationPipelines[integration] ?? [])))
      .finally(() => updateSyncPipelineStatus(integration, "IDLE", db));
  }
};
