import type { SqliteDb } from "../models/db-models";
import type { IntegrationStepFn, SyncStepPipeline } from "../models/models";

export const getStepFn = (pipeline: SyncStepPipeline, step: string): IntegrationStepFn | undefined => {
  let stepNum = 0;
  let subStep = 0;

  while (pipeline[stepNum]) {
    if (!pipeline[stepNum]![subStep]) {
      stepNum += 1;
      subStep = 0;
    } else if (Object.keys(pipeline[stepNum]![subStep]!)[0] === step) {
      return Object.values(pipeline[stepNum]![subStep]!)[0];
    } else if (pipeline[stepNum]![subStep + 1]) {
      subStep += 1;
    } else {
      stepNum += 1;
      subStep = 0;
    }
  }
};

export const runSyncPipeline = async (pipeline: SyncStepPipeline, incremental: boolean = true, db: SqliteDb, stepStart?: string,) => {
  let curStep = 0;
  if (stepStart) curStep = findPipelineStartStep(pipeline, stepStart) + 1;

  while (curStep < pipeline.length) {
    if (pipeline[curStep]) {
      await Promise.allSettled(pipeline[curStep]!.map((stepMap) => Object.values(stepMap)[0]!(incremental, db)));
    }
    curStep += 1;
  }
};

export const findPipelineStartStep = (pipeline: SyncStepPipeline, stepName: string): number => {
  let stepNum = 0;
  let subStep = 0;

  while (pipeline[stepNum]) {
    if (!pipeline[stepNum]![subStep]) {
      stepNum += 1;
      subStep = 0;
    } else if (Object.keys(pipeline[stepNum]![subStep]!)[0] === stepName) {
      return stepNum;
    } else if (pipeline[stepNum]![subStep + 1]) {
      subStep += 1;
    } else {
      stepNum += 1;
      subStep = 0;
    }
  }

  return stepNum;
};
