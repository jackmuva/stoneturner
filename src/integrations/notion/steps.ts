import type { IntegrationSteps } from "@/core/models/models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { agentExploreContextStep } from "@/core/services/agent-explore-context-step";
import { notionMarkdownToArtifact } from "./sync-steps/notion-markdown-to-artifact";
import { syncNotionMarkdown } from "./sync-steps/sync-notion-markdown";
import { syncNotionPages } from "./sync-steps/sync-notion-pages";

export const steps: IntegrationSteps = {
  "notion-sync-pages": syncNotionPages,
  "notion-sync-markdown": syncNotionMarkdown,
  "notion-markdown-to-artifact": notionMarkdownToArtifact,
  "index-vector": indexVectorDbStep,
  "agent-explore": agentExploreContextStep,
};
