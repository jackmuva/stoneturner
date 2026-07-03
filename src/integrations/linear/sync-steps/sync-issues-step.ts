import { upsertSyncTask } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";
import { batchInsertLinearIssue, getLatestLinearIssueUpdate } from "../db/queries";
import type { LinearIssueInsert } from "../db/schema";
import type { LinearIssueNode } from "../models/models";
import {
  ensureLinearAccessToken,
  fetchLinearTeams,
  getLinearCredentials,
  includeArchived,
  issueToRow,
  linearGraphql,
  PAGE_SIZE_LINEAR,
  teamsFromCursor,
  type LinearIssueCursor,
} from "./linear-utils";

const STEP = "linear-sync-issues";

const TEAM_ISSUES_QUERY = `
  query TeamIssues($teamId: String!, $after: String, $first: Int, $filter: IssueFilter, $includeArchived: Boolean) {
    team(id: $teamId) {
      id
      key
      name
      issues(first: $first, after: $after, filter: $filter, orderBy: updatedAt, includeArchived: $includeArchived) {
        nodes {
          id
          identifier
          title
          description
          url
          priority
          estimate
          createdAt
          updatedAt
          completedAt
          archivedAt
          dueDate
          assignee { id name email }
          creator { id name }
          state { id name type }
          project { id name }
          cycle { id name number }
          labels { nodes { id name } }
          comments(first: 50) {
            nodes {
              id
              body
              createdAt
              updatedAt
              user { id name }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

export const syncLinearIssuesStep = async (
  incremental: boolean = false,
  db: SqliteDb,
  cursor?: LinearIssueCursor,
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
  const since = incremental ? await getLatestLinearIssueUpdate(db) : null;
  const filter = since ? { updatedAt: { gt: since } } : undefined;

  let teams;
  try {
    teams = teamsFromCursor(await fetchLinearTeams(token, db), cursor?.teamId);
  } catch (e) {
    await upsertSyncTask({ integration: "linear", status: "FAILED", step: STEP, inputs: { error: String(e) } }, db);
    return;
  }

  for (const team of teams) {
    let after: string | null =
      cursor?.teamId === team.id ? (cursor.after ?? null) : null;

    while (true) {
      try {
        const data = await linearGraphql<{
          team: {
            key: string;
            issues: { nodes: LinearIssueNode[]; pageInfo: { hasNextPage: boolean; endCursor?: string | null } };
          } | null;
        }>(TEAM_ISSUES_QUERY, {
          teamId: team.id,
          after,
          first: PAGE_SIZE_LINEAR,
          filter,
          includeArchived: archived,
        }, token);

        const connection = data.team?.issues;
        if (!connection) break;

        const rows: LinearIssueInsert[] = [];
        for (const issue of connection.nodes) {
          rows.push(await issueToRow(issue, team.key, token));
        }
        await batchInsertLinearIssue(rows, db);

        const nextAfter = connection.pageInfo.hasNextPage
          ? (connection.pageInfo.endCursor ?? null)
          : null;

        await upsertSyncTask({
          integration: "linear",
          status: "SUCCESS",
          step: STEP,
          inputs: nextAfter
            ? { teamId: team.id, teamKey: team.key, count: rows.length, cursor: { teamId: team.id, after: nextAfter } }
            : { teamId: team.id, teamKey: team.key, count: rows.length },
        }, db);

        if (cursor) return;
        if (!nextAfter) break;
        after = nextAfter;
      } catch (e) {
        await upsertSyncTask({
          integration: "linear",
          status: "FAILED",
          step: STEP,
          inputs: { teamId: team.id, cursor: { teamId: team.id, after }, error: String(e) },
        }, db);
        return;
      }
    }
    if (cursor) return;
  }
};
