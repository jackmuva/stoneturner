import type { IntegrationSteps } from "@/core/models/models";
import { parseGongStep } from "./sync-steps/parse-step";
import { syncGongCallsStep } from "./sync-steps/sync-calls-step";
import { syncGongTranscriptsStep } from "./sync-steps/sync-transcripts-step";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";

export const steps: IntegrationSteps = {
  "gong-sync-call": syncGongCallsStep,
  "sync-transcript": syncGongTranscriptsStep,
  "gong-sync-transcript": syncGongTranscriptsStep,
  "parse": parseGongStep,
  "index-vector": indexVectorDbStep,
};
