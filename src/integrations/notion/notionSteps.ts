import type { IntegrationSteps } from "@/core/models/models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { notionMarkdownToArtifact } from "./sync-steps/notion-markdown-to-artifact";
import { syncNotionMarkdown } from "./sync-steps/sync-notion-markdown";
import { syncNotionPages } from "./sync-steps/sync-notion-pages";

export const notionSteps: IntegrationSteps = {
  "notion-sync-pages": syncNotionPages,
  "notion-sync-markdown": syncNotionMarkdown,
  "notion-markdown-to-artifact": notionMarkdownToArtifact,
  "index-vector": indexVectorDbStep,
};
