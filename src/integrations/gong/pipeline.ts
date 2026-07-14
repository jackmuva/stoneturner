import type { StepMapping, SyncStepPipeline } from "@/core/models/models";
import { bindAgentExplore, bindIndexVector } from "@/core/services/pipeline-helpers";
import { parseGongStep } from "./sync-steps/parse-step";
import { syncGongCallsStep } from "./sync-steps/sync-calls-step";
import { syncGongTranscriptsStep } from "./sync-steps/sync-transcripts-step";

const gongSyncCall: StepMapping = { "gong-sync-call": syncGongCallsStep };
const gongSyncTranscript: StepMapping = { "gong-sync-transcript": syncGongTranscriptsStep };
const parse: StepMapping = { parse: parseGongStep };
const indexVector: StepMapping = { "index-vector": bindIndexVector("gong") };
const agentExplore: StepMapping = { "agent-explore": bindAgentExplore("gong") };

export const gongPipeline: SyncStepPipeline = [
  [gongSyncCall, gongSyncTranscript],
  [parse],
  [indexVector],
  [agentExplore],
];
