import type { Integration } from "@/core/models/models";
import type { SqliteDb } from "@/core/models/db-models";
import { deleteMdArtifactsByIntegration, deleteSourceContextByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { githubConfig } from "./config";
import { handleGithubOauthRedirect } from "./sync-steps/github-utils";
import { deleteGithubData } from "./db/queries";
import { githubPipeline } from "./pipeline";

export const githubIntegration: Integration = {
  config: githubConfig,
  syncPipeline: githubPipeline,
  deleteSync: async (db: SqliteDb) => {
    await deleteSyncTasksByIntegration("github", db);
    await deleteMdArtifactsByIntegration("github", db);
    await deleteEmbeddingByIntegration("github", db);
    await deleteSourceContextByIntegration("github", db);
    await deleteGithubData(db);
  },
  handleRedirect: handleGithubOauthRedirect,
};
