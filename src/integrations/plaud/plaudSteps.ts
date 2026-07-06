import type { IntegrationSteps } from "@/core/models/models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { parsePlaudStep } from "./sync-steps/parse-step";
import { syncPlaudFilesStep } from "./sync-steps/sync-files-step";
import { syncPlaudTranscriptsStep } from "./sync-steps/sync-transcripts-step";

export const plaudSteps: IntegrationSteps = {
  "plaud-sync-files": syncPlaudFilesStep,
  "plaud-sync-transcripts": syncPlaudTranscriptsStep,
  "parse": parsePlaudStep,
  "index-vector": indexVectorDbStep,
};
