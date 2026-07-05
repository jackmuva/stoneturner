import type { IntegrationSteps } from "@/core/models/models";
import type { SqliteDb } from "@/core/models/db-models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { asInputs, resumeCursor, resumeOffset } from "@/integrations/retry-step-utils";
import {
  parseGithubCodeStep,
  parseGithubDiscussionsStep,
  parseGithubDocsStep,
  parseGithubIssuesStep,
  parseGithubPullsStep,
} from "./sync-steps/parse-steps";
import { syncGithubCodeStep } from "./sync-steps/sync-code-step";
import { syncGithubDiscussionsStep } from "./sync-steps/sync-discussions-step";
import { syncGithubDocsStep } from "./sync-steps/sync-docs-step";
import { syncGithubIssuesStep } from "./sync-steps/sync-issues-step";
import { syncGithubPullsStep } from "./sync-steps/sync-pulls-step";

const GITHUB_PARSE_BY_LABEL: Record<string, (db: SqliteDb, offset?: number, syncTaskId?: string) => Promise<void>> = {
  "github-parse-code": parseGithubCodeStep,
  "github-parse-discussions": parseGithubDiscussionsStep,
  "github-parse-docs": parseGithubDocsStep,
  "github-parse-issues": parseGithubIssuesStep,
  "github-parse-pulls": parseGithubPullsStep,
};

export const githubSteps: IntegrationSteps = {
  "github-sync-issues": (db, inputs, syncTaskId) => syncGithubIssuesStep(false, db, resumeCursor(inputs) as Parameters<typeof syncGithubIssuesStep>[2], syncTaskId),
  "github-sync-pulls": (db, inputs, syncTaskId) => syncGithubPullsStep(false, db, resumeCursor(inputs) as Parameters<typeof syncGithubPullsStep>[2], syncTaskId),
  "github-sync-docs": (db, inputs, syncTaskId) => syncGithubDocsStep(false, db, resumeCursor(inputs) as Parameters<typeof syncGithubDocsStep>[2], syncTaskId),
  "github-sync-discussions": (db, inputs, syncTaskId) => syncGithubDiscussionsStep(false, db, resumeCursor(inputs) as Parameters<typeof syncGithubDiscussionsStep>[2], syncTaskId),
  "github-sync-code": (db, inputs, syncTaskId) => syncGithubCodeStep(false, db, resumeCursor(inputs) as Parameters<typeof syncGithubCodeStep>[2], syncTaskId),
  "parse": async (db, inputs, syncTaskId) => {
    const obj = asInputs(inputs);
    const fn = GITHUB_PARSE_BY_LABEL[String(obj?.stepLabel ?? "")];
    if (!fn) throw new Error(`Unknown github parse stepLabel: ${obj?.stepLabel}`);
    await fn(db, resumeOffset(inputs), syncTaskId);
  },
  "index-vector": (db, inputs, syncTaskId) => indexVectorDbStep("github", true, db, resumeOffset(inputs), syncTaskId),
};
