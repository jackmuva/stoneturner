import type { IntegrationSteps } from "@/core/models/models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { agentExploreContextStep } from "@/core/services/agent-explore-context-step";
import { parseTwitterStep } from "./sync-steps/parse-step";
import { syncTwitterLikedTweetsStep } from "./sync-steps/sync-liked-tweets-step";

export const steps: IntegrationSteps = {
  "twitter-sync-liked-tweets": syncTwitterLikedTweetsStep,
  "parse": parseTwitterStep,
  "index-vector": indexVectorDbStep,
  "agent-explore": agentExploreContextStep,
};
