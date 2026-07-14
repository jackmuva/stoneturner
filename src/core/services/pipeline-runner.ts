import type { SqliteDb } from "../models/db-models";
import type { IntegrationStepFn, SyncStepPipeline } from "../models/models";
import { parseGithubStep } from "@/integrations/github/sync-steps/parse-steps";

const STEP_ALIASES: Record<string, Record<string, IntegrationStepFn>> = {
  github: { parse: parseGithubStep },
};

const GITHUB_PARSE_STEP_PREFIX = "github-parse-";

export const getStepFn = (
  pipeline: SyncStepPipeline,
  integration: string,
  step: string,
): IntegrationStepFn | undefined => {
  const alias = STEP_ALIASES[integration.toLowerCase()]?.[step];
  if (alias) return alias;

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

export const runSyncPipeline = async (
  pipeline: SyncStepPipeline,
  incremental: boolean = true,
  db: SqliteDb,
  stepStart?: string,
  integration?: string,
) => {
  let curStep = 0;
  if (stepStart) curStep = findPipelineStartStep(pipeline, stepStart, integration) + 1;

  while (curStep < pipeline.length) {
    if (pipeline[curStep]) {
      await Promise.allSettled(pipeline[curStep]!.map((stepMap) => Object.values(stepMap)[0]!(incremental, db)));
    }
    curStep += 1;
  }
};

const findPipelineStartStep = (pipeline: SyncStepPipeline, stepName: string, integration?: string): number => {
  if (stepName === "parse" && integration?.toLowerCase() === "github") {
    const githubParseStage = pipeline.findIndex((stage) =>
      stage?.some((stepMap) => Object.keys(stepMap)[0]?.startsWith(GITHUB_PARSE_STEP_PREFIX)),
    );
    if (githubParseStage !== -1) return githubParseStage;
  }

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
