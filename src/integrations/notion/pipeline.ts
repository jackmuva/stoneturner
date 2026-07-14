import type { StepMapping, SyncStepPipeline } from "@/core/models/models";
import { bindAgentExplore, bindIndexVector } from "@/core/services/pipeline-helpers";
import { notionMarkdownToArtifact } from "./sync-steps/notion-markdown-to-artifact";
import { syncNotionMarkdown } from "./sync-steps/sync-notion-markdown";
import { syncNotionPages } from "./sync-steps/sync-notion-pages";

const syncPages: StepMapping = { "notion-sync-pages": syncNotionPages };
const syncMarkdown: StepMapping = { "notion-sync-markdown": syncNotionMarkdown };
const markdownToArtifact: StepMapping = { "notion-markdown-to-artifact": notionMarkdownToArtifact };
const indexVector: StepMapping = { "index-vector": bindIndexVector("notion") };
const agentExplore: StepMapping = { "agent-explore": bindAgentExplore("notion") };

export const notionPipeline: SyncStepPipeline = [
  [syncPages],
  [syncMarkdown],
  [markdownToArtifact],
  [indexVector],
  [agentExplore],
];
