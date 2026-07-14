import type { StepMapping, SyncStepPipeline } from "@/core/models/models";
import { bindAgentExplore, bindIndexVector } from "@/core/services/pipeline-helpers";
import { parseFirecrawlStep } from "./sync-steps/parse-step";
import { syncFirecrawlCrawlStep } from "./sync-steps/sync-crawl-step";

const syncCrawl: StepMapping = { "firecrawl-sync-crawl": syncFirecrawlCrawlStep };
const parse: StepMapping = { parse: parseFirecrawlStep };
const indexVector: StepMapping = { "index-vector": bindIndexVector("firecrawl") };
const agentExplore: StepMapping = { "agent-explore": bindAgentExplore("firecrawl") };

export const firecrawlPipeline: SyncStepPipeline = [
  [syncCrawl],
  [parse],
  [indexVector],
  [agentExplore],
];
