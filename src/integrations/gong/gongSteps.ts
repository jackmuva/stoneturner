import type { IntegrationSteps } from "@/core/models/models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { resumeOffset, resumeStringCursor } from "@/core/services/retry-cron";
import { parseGongStep } from "./sync-steps/parse-step";
import { syncGongCallsStep } from "./sync-steps/sync-calls-step";
import { syncGongTranscriptsStep } from "./sync-steps/sync-transcripts-step";

export const gongSteps: IntegrationSteps = {
  "gong-sync-call": (db, inputs, syncTaskId) => syncGongCallsStep(false, db, resumeStringCursor(inputs), syncTaskId),
  "sync-transcript": (db, inputs, syncTaskId) => syncGongTranscriptsStep(false, db, resumeStringCursor(inputs), syncTaskId),
  "gong-sync-transcript": (db, inputs, syncTaskId) => syncGongTranscriptsStep(false, db, resumeStringCursor(inputs), syncTaskId),
  "parse": (db, inputs, syncTaskId) => parseGongStep(db, resumeOffset(inputs), syncTaskId),
  "index-vector": (db, inputs, syncTaskId) => indexVectorDbStep("gong", true, db, resumeOffset(inputs), syncTaskId),
};
