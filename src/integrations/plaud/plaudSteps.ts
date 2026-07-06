import type { IntegrationSteps } from "@/core/models/models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { resumeOffset } from "@/core/services/retry-cron";
import { parsePlaudStep } from "./sync-steps/parse-step";
import { syncPlaudFilesStep } from "./sync-steps/sync-files-step";
import { syncPlaudTranscriptsStep } from "./sync-steps/sync-transcripts-step";

export const plaudSteps: IntegrationSteps = {
  "plaud-sync-files": (db, _inputs, syncTaskId) => syncPlaudFilesStep(false, db, syncTaskId),
  "plaud-sync-transcripts": (db, _inputs, syncTaskId) => syncPlaudTranscriptsStep(db, syncTaskId),
  "parse": (db, inputs, syncTaskId) => parsePlaudStep(db, resumeOffset(inputs), syncTaskId),
  "index-vector": (db, inputs, syncTaskId) => indexVectorDbStep("plaud", true, db, resumeOffset(inputs), syncTaskId),
};
