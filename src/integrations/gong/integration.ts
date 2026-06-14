import type { Integration, IntegrationConfig } from "@/core/models/models";
import { syncGongCallsStep } from "./sync-steps/sync-calls-step";
import { syncGongTranscriptsStep } from "./sync-steps/sync-transcripts-step";
import { parseGongStep } from "./sync-steps/parse-step";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";

const gongConfig: IntegrationConfig = {
  integration: "Gong",
  icon: "/assets/gong.png",
  integrationType: "BASIC_TOKEN",
  docs: "https://help.gong.io/docs/receive-access-to-the-api",
  inputs: [
    {
      input: "accessKey",
      label: "Access Key",
    },
    {
      input: "secretKey",
      label: "Access Key Secret",
    },
    {
      input: "baseUrl",
      label: "Gong API Base URL",
    }
  ],
}

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
