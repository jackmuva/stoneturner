import type { IntegrationSteps } from "@/core/models/models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { resumeOffset } from "@/integrations/retry-step-utils";
import { parseTwitterStep } from "./sync-steps/parse-step";
import { syncTwitterLikedTweetsStep } from "./sync-steps/sync-liked-tweets-step";

export const twitterSteps: IntegrationSteps = {
  "twitter-sync-liked-tweets": (db, _inputs, syncTaskId) => syncTwitterLikedTweetsStep(false, db, syncTaskId),
  "parse": (db, inputs, syncTaskId) => parseTwitterStep(db, resumeOffset(inputs), syncTaskId),
  "index-vector": (db, inputs, syncTaskId) => indexVectorDbStep("twitter", true, db, resumeOffset(inputs), syncTaskId),
};
