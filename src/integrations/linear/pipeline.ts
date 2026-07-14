import type { StepMapping, SyncStepPipeline } from "@/core/models/models";
import { bindAgentExplore, bindIndexVector } from "@/core/services/pipeline-helpers";
import { parseLinearStep } from "./sync-steps/parse-step";
import { syncLinearIssuesStep } from "./sync-steps/sync-issues-step";
import { syncLinearProjectsStep } from "./sync-steps/sync-projects-step";

const syncIssues: StepMapping = { "linear-sync-issues": syncLinearIssuesStep };
const syncProjects: StepMapping = { "linear-sync-projects": syncLinearProjectsStep };
const parse: StepMapping = { parse: parseLinearStep };
const indexVector: StepMapping = { "index-vector": bindIndexVector("linear") };
const agentExplore: StepMapping = { "agent-explore": bindAgentExplore("linear") };

export const linearPipeline: SyncStepPipeline = [
  [syncIssues, syncProjects],
  [parse],
  [indexVector],
  [agentExplore],
];
