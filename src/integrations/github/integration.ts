import type { Integration } from "@/core/models/models";
import type { SqliteDb } from "@/core/models/db-models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { agentExploreContextStep } from "@/core/services/agent-explore-context-step";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { githubConfig } from "./config";
import { handleGithubOauthRedirect } from "./sync-steps/github-utils";
import { syncGithubIssuesStep } from "./sync-steps/sync-issues-step";
import { syncGithubPullsStep } from "./sync-steps/sync-pulls-step";
import { syncGithubDocsStep } from "./sync-steps/sync-docs-step";
import { syncGithubDiscussionsStep } from "./sync-steps/sync-discussions-step";
import { syncGithubCodeStep } from "./sync-steps/sync-code-step";
import { parseGithubCodeStep, parseGithubDiscussionsStep, parseGithubDocsStep, parseGithubIssuesStep, parseGithubPullsStep } from "./sync-steps/parse-steps";
import { deleteGithubData } from "./db/queries";

export const syncGithubPipeline = async (incremental: boolean = false, db: SqliteDb) => {
  await Promise.all([
    syncGithubIssuesStep(incremental, db),
    syncGithubPullsStep(incremental, db),
    syncGithubDocsStep(incremental, db),
    syncGithubDiscussionsStep(incremental, db),
    syncGithubCodeStep(incremental, db),
  ]);
  await Promise.all([
    parseGithubIssuesStep(incremental, db),
    parseGithubPullsStep(incremental, db),
    parseGithubDocsStep(incremental, db),
    parseGithubDiscussionsStep(incremental, db),
    parseGithubCodeStep(incremental, db),
  ]);
  await indexVectorDbStep(incremental, db, { integration: "github" });
  await agentExploreContextStep(incremental, db, { integration: "github" });
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
