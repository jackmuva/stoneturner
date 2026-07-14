import type { StepMapping, SyncStepPipeline } from "@/core/models/models";
import { parseGongStep } from "./sync-steps/parse-step";
import { syncGongCallsStep } from "./sync-steps/sync-calls-step";
import { syncGongTranscriptsStep } from "./sync-steps/sync-transcripts-step";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { agentExploreContextStep } from "@/core/services/agent-explore-context-step";

const gongSyncCall: StepMapping = { "gong-sync-call": syncGongCallsStep, };
const gongSyncTranscript: StepMapping = { "gong-sync-transcript": syncGongTranscriptsStep, }
const parse: StepMapping = { "parse": parseGongStep, }
const indexVector: StepMapping = { "index-vector": indexVectorDbStep, }
const agentExplore: StepMapping = { "agent-explore": agentExploreContextStep, }

export const gongPipeline: SyncStepPipeline = [
  [gongSyncCall, gongSyncTranscript],
  [parse],
  [indexVector],
  [agentExplore],
];
