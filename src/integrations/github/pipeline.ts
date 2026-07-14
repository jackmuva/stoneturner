import type { StepMapping, SyncStepPipeline } from "@/core/models/models";
import { bindAgentExplore, bindIndexVector } from "@/core/services/pipeline-helpers";
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

const syncIssues: StepMapping = { "github-sync-issues": syncGithubIssuesStep };
const syncPulls: StepMapping = { "github-sync-pulls": syncGithubPullsStep };
const syncDocs: StepMapping = { "github-sync-docs": syncGithubDocsStep };
const syncDiscussions: StepMapping = { "github-sync-discussions": syncGithubDiscussionsStep };
const syncCode: StepMapping = { "github-sync-code": syncGithubCodeStep };
const parseIssues: StepMapping = { "github-parse-issues": parseGithubIssuesStep };
const parsePulls: StepMapping = { "github-parse-pulls": parseGithubPullsStep };
const parseDocs: StepMapping = { "github-parse-docs": parseGithubDocsStep };
const parseDiscussions: StepMapping = { "github-parse-discussions": parseGithubDiscussionsStep };
const parseCode: StepMapping = { "github-parse-code": parseGithubCodeStep };
const indexVector: StepMapping = { "index-vector": bindIndexVector("github") };
const agentExplore: StepMapping = { "agent-explore": bindAgentExplore("github") };

export const githubPipeline: SyncStepPipeline = [
  [syncIssues, syncPulls, syncDocs, syncDiscussions, syncCode],
  [parseIssues, parsePulls, parseDocs, parseDiscussions, parseCode],
  [indexVector],
  [agentExplore],
];
