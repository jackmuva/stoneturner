import type { IntegrationSteps } from "@/core/models/models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { agentExploreContextStep } from "@/core/services/agent-explore-context-step";
import { parseGithubStep } from "./sync-steps/parse-steps";
import { syncGithubCodeStep } from "./sync-steps/sync-code-step";
import { syncGithubDiscussionsStep } from "./sync-steps/sync-discussions-step";
import { syncGithubDocsStep } from "./sync-steps/sync-docs-step";
import { syncGithubIssuesStep } from "./sync-steps/sync-issues-step";
import { syncGithubPullsStep } from "./sync-steps/sync-pulls-step";

export const steps: IntegrationSteps = {
  "github-sync-issues": syncGithubIssuesStep,
  "github-sync-pulls": syncGithubPullsStep,
  "github-sync-docs": syncGithubDocsStep,
  "github-sync-discussions": syncGithubDiscussionsStep,
  "github-sync-code": syncGithubCodeStep,
  "parse": parseGithubStep,
  "index-vector": indexVectorDbStep,
  "agent-explore": agentExploreContextStep,
};
