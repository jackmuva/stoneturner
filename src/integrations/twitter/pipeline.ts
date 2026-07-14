import type { StepMapping, SyncStepPipeline } from "@/core/models/models";
import { bindAgentExplore, bindIndexVector } from "@/core/services/pipeline-helpers";
import { parseTwitterStep } from "./sync-steps/parse-step";
import { syncTwitterLikedTweetsStep } from "./sync-steps/sync-liked-tweets-step";

const syncLikedTweets: StepMapping = { "twitter-sync-liked-tweets": syncTwitterLikedTweetsStep };
const parse: StepMapping = { parse: parseTwitterStep };
const indexVector: StepMapping = { "index-vector": bindIndexVector("twitter") };
const agentExplore: StepMapping = { "agent-explore": bindAgentExplore("twitter") };

export const twitterPipeline: SyncStepPipeline = [
  [syncLikedTweets],
  [parse],
  [indexVector],
  [agentExplore],
];
