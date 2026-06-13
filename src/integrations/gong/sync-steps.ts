import { syncGongCallsStep } from "./sync-steps/sync-calls-step";
import { syncGongTranscriptsStep } from "./sync-steps/sync-transcripts-step";
import { parseGongStep } from "./sync-steps/parse-step";
import { indexVectorDbStep } from "./sync-steps/index-vector-db-step";

export const gongPipelinestep = async () => {
  await Promise.all([
    syncGongCallsStep(true),
    syncGongTranscriptsStep(true)
  ]);
  await parseGongStep();
  await indexVectorDbStep()
}
