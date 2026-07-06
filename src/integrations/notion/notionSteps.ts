import type { IntegrationSteps } from "@/core/models/models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { resumeOffset, resumeStringCursor } from "@/core/services/retry-cron";
import { notionMarkdownToArtifact } from "./sync-steps/notion-markdown-to-artifact";
import { syncNotionMarkdown } from "./sync-steps/sync-notion-markdown";
import { syncNotionPages } from "./sync-steps/sync-notion-pages";

export const notionSteps: IntegrationSteps = {
  "notion-sync-pages": (db, inputs, syncTaskId) => syncNotionPages(false, db, resumeStringCursor(inputs), syncTaskId),
  "notion-sync-markdown": (db, inputs, syncTaskId) => syncNotionMarkdown(db, undefined, resumeOffset(inputs), syncTaskId),
  "notion-markdown-to-artifact": (db, inputs, syncTaskId) => notionMarkdownToArtifact(db, undefined, resumeOffset(inputs), syncTaskId),
  "index-vector": (db, inputs, syncTaskId) => indexVectorDbStep("notion", true, db, resumeOffset(inputs), syncTaskId),
};
