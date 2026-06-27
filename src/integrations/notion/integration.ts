import type { Integration } from "@/core/models/models";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration, upsertIntegrationCredential } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { notionConfig } from "./config";
import { handleNotionRefresh, handleOauthRedirect, NOTION_BASE_API } from "./sync-steps/notion-utils";
import { syncNotionPages } from "./sync-steps/sync-notion-pages";
import { deleteNotionData, getMostRecentEditedTime } from "./db/queries";
import { syncNotionMarkdown } from "./sync-steps/sync-notion-markdown";
import { notionMarkdownToArtifact } from "./sync-steps/notion-markdown-to-artifact";

export const syncNotionPipeline = async (incremental: boolean = true) => {
  const lastEditedDate: string | null = await getMostRecentEditedTime();
  await syncNotionPages();
  await syncNotionMarkdown(incremental ? {lastEditedDate} : undefined);
  await notionMarkdownToArtifact(incremental ? {lastEditedDate} : undefined);
  await indexVectorDbStep("notion", incremental);
}

export const notionIntegration: Integration = {
  config: notionConfig,
  sync: async () => await syncNotionPipeline(false),
  syncUpdates: async () => await syncNotionPipeline(true),
  deleteSync: async () => {
    await deleteNotionData();
    await deleteSyncTasksByIntegration("notion");
    await deleteMdArtifactsByIntegration("notion");
    await deleteEmbeddingByIntegration("notion");
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: handleNotionRefresh,
}
