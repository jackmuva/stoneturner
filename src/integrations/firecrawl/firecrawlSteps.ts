import type { IntegrationSteps } from "@/core/models/models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { resumeOffset, resumeStringCursor } from "@/core/services/retry-cron";
import { parseFirecrawlStep } from "./sync-steps/parse-step";
import { syncFirecrawlCrawlStep } from "./sync-steps/sync-crawl-step";

export const firecrawlSteps: IntegrationSteps = {
  "firecrawl-sync-crawl": (db, inputs, syncTaskId) => syncFirecrawlCrawlStep(false, db, resumeStringCursor(inputs), syncTaskId),
  "parse": (db, inputs, syncTaskId) => parseFirecrawlStep(db, resumeOffset(inputs), syncTaskId),
  "index-vector": (db, inputs, syncTaskId) => indexVectorDbStep("firecrawl", true, db, resumeOffset(inputs), syncTaskId),
};
