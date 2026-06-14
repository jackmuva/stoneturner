import type { Integration, IntegrationConfig } from "@/core/models/models";
import { syncGongCallsStep } from "./sync-steps/sync-calls-step";
import { syncGongTranscriptsStep } from "./sync-steps/sync-transcripts-step";
import { parseGongStep } from "./sync-steps/parse-step";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { gongConfig } from "./config";

export const syncGongPipeline = async () => {
  await Promise.all([
    syncGongCallsStep(true),
    syncGongTranscriptsStep(true)
  ]);
  await parseGongStep();
  await indexVectorDbStep("Gong")
}

export const gongIntegration: Integration = {
  config: gongConfig,
  sync: syncGongPipeline,
}
