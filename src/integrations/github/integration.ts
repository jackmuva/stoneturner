import type { Integration } from "@/core/models/models";
import type { SqliteDb } from "@/core/models/db-models";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { githubConfig } from "./config";
import { handleGithubOauthRedirect } from "./sync-steps/github-utils";
import { syncGithubIssuesStep } from "./sync-steps/sync-issues-step";
import { syncGithubPullsStep } from "./sync-steps/sync-pulls-step";
import { syncGithubDocsStep } from "./sync-steps/sync-docs-step";
import { syncGithubDiscussionsStep } from "./sync-steps/sync-discussions-step";
import { syncGithubCodeStep } from "./sync-steps/sync-code-step";
import { parseGithubStep } from "./sync-steps/parse-step";
import { deleteGithubData } from "./db/queries";

export const syncGithubPipeline = async (incremental: boolean = false, db: SqliteDb) => {
  await Promise.all([
    syncGithubIssuesStep(incremental, db),
    syncGithubPullsStep(incremental, db),
    syncGithubDocsStep(incremental, db),
    syncGithubDiscussionsStep(incremental, db),
    syncGithubCodeStep(incremental, db),
  ]);
  await parseGithubStep(db);
  await indexVectorDbStep("github", incremental, db);
};

export const githubIntegration: Integration = {
  config: githubConfig,
  sync: async (db: SqliteDb) => await syncGithubPipeline(false, db),
  syncUpdates: async (db: SqliteDb) => await syncGithubPipeline(true, db),
  deleteSync: async (db: SqliteDb) => {
    await deleteSyncTasksByIntegration("github", db);
    await deleteMdArtifactsByIntegration("github", db);
    await deleteEmbeddingByIntegration("github", db);
    await deleteGithubData(db);
  },
  handleRedirect: handleGithubOauthRedirect,
};
