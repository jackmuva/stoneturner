import type { IntegrationSteps } from "@/core/models/models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { parseFirecrawlStep } from "./sync-steps/parse-step";
import { syncFirecrawlCrawlStep } from "./sync-steps/sync-crawl-step";

export const firecrawlSteps: IntegrationSteps = {
  "firecrawl-sync-crawl": syncFirecrawlCrawlStep,
  "parse": parseFirecrawlStep,
  "index-vector": indexVectorDbStep,
};
