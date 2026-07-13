import type { Integration } from "@/core/models/models";
import { gongConfig } from "./config";
import { deleteMdArtifactsByIntegration, deleteSourceContextByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { deleteAllGongData } from "./db/queries";
import type { SqliteDb } from "@/core/models/db-models";
import { gongPipeline } from "./steps";

export const gongIntegration: Integration = {
  config: gongConfig,
  syncPipeline: gongPipeline,
  deleteSync: async(db: SqliteDb) => {
    await deleteSyncTasksByIntegration("gong", db);
    await deleteMdArtifactsByIntegration("gong", db);
    await deleteEmbeddingByIntegration("gong", db);
    await deleteSourceContextByIntegration("gong", db);
    await deleteAllGongData(db);
  }
}
