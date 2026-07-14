import type { SqliteDb } from "@/core/models/db-models";
import type { LinearProjectInsert } from "../db/schema";
import { batchInsertLinearProject, getLatestLinearProjectUpdate } from "../db/queries";
import type { LinearProjectNode } from "../models/models";
import {
  displayName,
  projectArtifactId,
  type LinearSyncInputs,
  syncLinearConnection,
} from "./linear-utils";

const STEP = "linear-sync-projects";

const PROJECTS_QUERY = `
  query Projects($first: Int!, $after: String, $filter: ProjectFilter) {
    projects(first: $first, after: $after, orderBy: updatedAt, filter: $filter) {
      nodes {
        id
        name
        description
        state
        progress
        url
        createdAt
        updatedAt
        startDate
        targetDate
        teams { nodes { name key } }
        lead { name displayName }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const mapProject = (node: LinearProjectNode): LinearProjectInsert => ({
  projectId: node.id,
  artifactId: projectArtifactId(node.id),
  name: node.name,
  description: node.description ?? null,
  state: node.state,
  progress: node.progress,
  teamKeys: (node.teams?.nodes ?? []).map((t) => t.key),
  teamNames: (node.teams?.nodes ?? []).map((t) => t.name),
  lead: displayName(node.lead),
  url: node.url,
  startDate: node.startDate ?? null,
  targetDate: node.targetDate ?? null,
  createdAt: node.createdAt,
  updatedAt: node.updatedAt,
});

export const syncLinearProjectsStep = async (
  incremental: boolean = false,
  db: SqliteDb,
  inputs?: LinearSyncInputs,
  syncTaskId?: string,
): Promise<void> => {
  await syncLinearConnection<LinearProjectNode, {
    data?: {
      projects: {
        nodes: LinearProjectNode[];
        pageInfo: { hasNextPage: boolean; endCursor?: string | null };
      };
    };
  }>(incremental, db, {
    step: STEP,
    connectionField: "projects",
    query: PROJECTS_QUERY,
    getLatestUpdate: getLatestLinearProjectUpdate,
    mapRows: async (nodes) => {
      await batchInsertLinearProject(nodes.map(mapProject), db);
    },
  }, inputs, syncTaskId);
};
