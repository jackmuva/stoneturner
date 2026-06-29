import type { Integration } from "@/core/models/models";
import type { SqliteDb } from "@/core/models/db-models";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { notionConfig } from "./config";
import { handleNotionRefresh, handleOauthRedirect } from "./sync-steps/notion-utils";
import { syncNotionPages } from "./sync-steps/sync-notion-pages";
import { deleteNotionData, getMostRecentEditedTime } from "./db/queries";
import { syncNotionMarkdown } from "./sync-steps/sync-notion-markdown";
import { notionMarkdownToArtifact } from "./sync-steps/notion-markdown-to-artifact";

export const syncNotionPipeline = async (incremental: boolean = true, db: SqliteDb) => {
  const lastEditedDate: string | null = await getMostRecentEditedTime(db);
  await syncNotionPages(incremental, db);
  await syncNotionMarkdown(db, incremental ? {lastEditedDate} : undefined);
  await notionMarkdownToArtifact(db, incremental ? {lastEditedDate} : undefined);
  await indexVectorDbStep("notion", incremental, db);
}

export const notionIntegration: Integration = {
  config: notionConfig,
  sync: async (db: SqliteDb) => await syncNotionPipeline(false, db),
  syncUpdates: async (db: SqliteDb) => await syncNotionPipeline(true, db),
  deleteSync: async (db: SqliteDb) => {
    await deleteNotionData(db);
    await deleteSyncTasksByIntegration("notion", db);
    await deleteMdArtifactsByIntegration("notion", db);
    await deleteEmbeddingByIntegration("notion", db);
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: handleNotionRefresh,
}
