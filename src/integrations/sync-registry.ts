import type { SyncStepPipeline } from "@/core/models/models";
import { gongPipeline } from "./gong/pipeline";

export const pipelineRegistry: { [integration: string]: SyncStepPipeline } = {
  gong: gongPipeline,
};

