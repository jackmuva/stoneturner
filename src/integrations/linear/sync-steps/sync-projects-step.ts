import { upsertSyncTask } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";
import { batchInsertLinearProject, getLatestLinearProjectUpdate } from "../db/queries";
import type { LinearProjectInsert } from "../db/schema";
import type { LinearProjectNode } from "../models/models";
import {
  ensureLinearAccessToken,
  getLinearCredentials,
  includeArchived,
  linearGraphql,
  PAGE_SIZE_LINEAR,
  parseTeamKeys,
  projectToRow,
  type LinearListCursor,
} from "./linear-utils";

const STEP = "linear-sync-projects";

const PROJECTS_QUERY = `
  query Projects($after: String, $first: Int, $filter: ProjectFilter, $includeArchived: Boolean) {
    projects(first: $first, after: $after, filter: $filter, orderBy: updatedAt, includeArchived: $includeArchived) {
      nodes {
        id
        name
        description
        url
        state
        progress
        startDate
        targetDate
        createdAt
        updatedAt
        archivedAt
        lead { id name }
        teams { nodes { id key name } }
        projectUpdates(first: 50) {
          nodes {
            id
            body
            health
            createdAt
            user { name }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const syncLinearProjectsStep = async (
  incremental: boolean = false,
  db: SqliteDb,
  cursor?: LinearListCursor,
) => {
  let token: string;
  try {
    token = await ensureLinearAccessToken(db);
  } catch (e) {
    await upsertSyncTask({ integration: "linear", status: "FAILED", step: STEP, inputs: { error: String(e) } }, db);
    return;
  }

  const cred = await getLinearCredentials(db);
  const archived = includeArchived(cred?.options);
  const teamKeys = parseTeamKeys(cred?.options);
  const since = incremental ? await getLatestLinearProjectUpdate(db) : null;

  const filter: Record<string, unknown> = {};
  if (since) filter.updatedAt = { gt: since };
  if (teamKeys.length > 0) filter.accessibleTeams = { key: { in: teamKeys } };

  let after: string | null = cursor?.after ?? null;

  while (true) {
    try {
      const data = await linearGraphql<{
        projects: {
          nodes: LinearProjectNode[];
          pageInfo: { hasNextPage: boolean; endCursor?: string | null };
        };
      }>(PROJECTS_QUERY, {
        after,
        first: PAGE_SIZE_LINEAR,
        filter: Object.keys(filter).length ? filter : undefined,
        includeArchived: archived,
      }, token);

      const rows: LinearProjectInsert[] = data.projects.nodes.map(projectToRow);
      await batchInsertLinearProject(rows, db);

      const nextAfter = data.projects.pageInfo.hasNextPage
        ? (data.projects.pageInfo.endCursor ?? null)
        : null;

      await upsertSyncTask({
        integration: "linear",
        status: "SUCCESS",
        step: STEP,
        inputs: nextAfter
          ? { count: rows.length, cursor: { after: nextAfter } }
          : { count: rows.length },
      }, db);

      if (cursor) return;
      if (!nextAfter) break;
      after = nextAfter;
    } catch (e) {
      await upsertSyncTask({
        integration: "linear",
        status: "FAILED",
        step: STEP,
        inputs: { cursor: { after }, error: String(e) },
      }, db);
      return;
    }
  }
};
