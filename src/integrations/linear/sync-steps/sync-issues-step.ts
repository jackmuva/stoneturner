import type { SqliteDb } from "@/core/models/db-models";
import type { LinearIssueInsert } from "../db/schema";
import { batchInsertLinearIssue, getLatestLinearIssueUpdate } from "../db/queries";
import type { LinearIssueNode, StoredLinearComment } from "../models/models";
import {
  displayName,
  issueArtifactId,
  type LinearSyncInputs,
  syncLinearConnection,
} from "./linear-utils";

const STEP = "linear-sync-issues";

const ISSUES_QUERY = `
  query Issues($first: Int!, $after: String, $filter: IssueFilter) {
    issues(first: $first, after: $after, orderBy: updatedAt, filter: $filter) {
      nodes {
        id
        identifier
        title
        description
        priority
        estimate
        url
        createdAt
        updatedAt
        state { name type }
        team { id key name }
        assignee { name displayName }
        labels { nodes { name } }
        project { id name }
        comments(first: 100) {
          nodes {
            body
            createdAt
            user { name displayName }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const mapIssue = (node: LinearIssueNode): LinearIssueInsert => {
  const comments: StoredLinearComment[] = (node.comments?.nodes ?? []).map((c) => ({
    author: displayName(c.user),
    body: c.body,
    createdAt: c.createdAt,
  }));

  return {
    issueId: node.id,
    artifactId: issueArtifactId(node.identifier),
    identifier: node.identifier,
    title: node.title,
    description: node.description ?? null,
    priority: node.priority ?? null,
    estimate: node.estimate ?? null,
    stateName: node.state?.name ?? null,
    stateType: node.state?.type ?? null,
    teamId: node.team?.id ?? null,
    teamKey: node.team?.key ?? null,
    teamName: node.team?.name ?? null,
    assignee: displayName(node.assignee),
    labels: (node.labels?.nodes ?? []).map((l) => l.name),
    projectId: node.project?.id ?? null,
    projectName: node.project?.name ?? null,
    comments,
    url: node.url,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  };
};

export const syncLinearIssuesStep = async (
  incremental: boolean = false,
  db: SqliteDb,
  inputs?: LinearSyncInputs,
  syncTaskId?: string,
): Promise<void> => {
  await syncLinearConnection<LinearIssueNode, {
    data?: {
      issues: {
        nodes: LinearIssueNode[];
        pageInfo: { hasNextPage: boolean; endCursor?: string | null };
      };
    };
  }>(incremental, db, {
    step: STEP,
    connectionField: "issues",
    query: ISSUES_QUERY,
    getLatestUpdate: getLatestLinearIssueUpdate,
    mapRows: async (nodes) => {
      await batchInsertLinearIssue(nodes.map(mapIssue), db);
    },
  }, inputs, syncTaskId);
};
