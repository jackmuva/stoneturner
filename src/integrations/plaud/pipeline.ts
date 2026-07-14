import type { StepMapping, SyncStepPipeline } from "@/core/models/models";
import { bindAgentExplore, bindIndexVector } from "@/core/services/pipeline-helpers";
import { parsePlaudStep } from "./sync-steps/parse-step";
import { syncPlaudFilesStep } from "./sync-steps/sync-files-step";
import { syncPlaudTranscriptsStep } from "./sync-steps/sync-transcripts-step";

const syncFiles: StepMapping = { "plaud-sync-files": syncPlaudFilesStep };
const syncTranscripts: StepMapping = { "plaud-sync-transcripts": syncPlaudTranscriptsStep };
const parse: StepMapping = { parse: parsePlaudStep };
const indexVector: StepMapping = { "index-vector": bindIndexVector("plaud") };
const agentExplore: StepMapping = { "agent-explore": bindAgentExplore("plaud") };

export const plaudPipeline: SyncStepPipeline = [
  [syncFiles],
  [syncTranscripts],
  [parse],
  [indexVector],
  [agentExplore],
];
