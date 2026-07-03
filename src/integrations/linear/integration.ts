import type { Integration } from "@/core/models/models";
import type { SqliteDb } from "@/core/models/db-models";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { linearConfig } from "./config";
import { deleteLinearData } from "./db/queries";
import { handleLinearRefresh, handleOauthRedirect, revokeLinearToken, getLinearCredentials } from "./sync-steps/linear-utils";
import { syncLinearIssuesStep } from "./sync-steps/sync-issues-step";
import { syncLinearProjectsStep } from "./sync-steps/sync-projects-step";
import { syncLinearDocumentsStep } from "./sync-steps/sync-documents-step";
import { parseLinearDocumentsStep, parseLinearIssuesStep, parseLinearProjectsStep } from "./sync-steps/parse-steps";

export const syncLinearPipeline = async (incremental: boolean = false, db: SqliteDb) => {
  await Promise.all([
    syncLinearIssuesStep(incremental, db),
    syncLinearProjectsStep(incremental, db),
    syncLinearDocumentsStep(incremental, db),
  ]);
  await Promise.all([
    parseLinearIssuesStep(db),
    parseLinearProjectsStep(db),
    parseLinearDocumentsStep(db),
  ]);
  await indexVectorDbStep("linear", incremental, db);
};

export const linearIntegration: Integration = {
  config: linearConfig,
  sync: async (db: SqliteDb) => await syncLinearPipeline(false, db),
  syncUpdates: async (db: SqliteDb) => await syncLinearPipeline(true, db),
  deleteSync: async (db: SqliteDb) => {
    const cred = await getLinearCredentials(db);
    if (cred?.accessToken) {
      try {
        await revokeLinearToken(cred.accessToken);
      } catch {
        // Best-effort revocation; continue purging local data.
      }
    }
    await deleteSyncTasksByIntegration("linear", db);
    await deleteMdArtifactsByIntegration("linear", db);
    await deleteEmbeddingByIntegration("linear", db);
    await deleteLinearData(db);
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: handleLinearRefresh,
};
