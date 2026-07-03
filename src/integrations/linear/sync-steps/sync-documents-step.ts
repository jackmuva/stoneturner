import { upsertSyncTask } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";
import { batchInsertLinearDocument, getLatestLinearDocumentUpdate } from "../db/queries";
import type { LinearDocumentInsert } from "../db/schema";
import type { LinearDocumentNode } from "../models/models";
import {
  documentToRow,
  ensureLinearAccessToken,
  getLinearCredentials,
  includeArchived,
  linearGraphql,
  PAGE_SIZE_LINEAR,
  parseTeamKeys,
  type LinearListCursor,
} from "./linear-utils";

const STEP = "linear-sync-documents";

const DOCUMENTS_QUERY = `
  query Documents($after: String, $first: Int, $filter: DocumentFilter, $includeArchived: Boolean) {
    documents(first: $first, after: $after, filter: $filter, orderBy: updatedAt, includeArchived: $includeArchived) {
      nodes {
        id
        title
        slugId
        url
        content
        createdAt
        updatedAt
        archivedAt
        creator { name }
        updatedBy { name }
        project { id name }
        issue { id identifier title }
        comments(first: 50) {
          nodes {
            id
            body
            createdAt
            user { name }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const syncLinearDocumentsStep = async (
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
  const since = incremental ? await getLatestLinearDocumentUpdate(db) : null;

  const filter: Record<string, unknown> = {};
  if (since) filter.updatedAt = { gt: since };
  if (teamKeys.length > 0) filter.team = { key: { in: teamKeys } };

  let after: string | null = cursor?.after ?? null;

  while (true) {
    try {
      const data = await linearGraphql<{
        documents: {
          nodes: LinearDocumentNode[];
          pageInfo: { hasNextPage: boolean; endCursor?: string | null };
        };
      }>(DOCUMENTS_QUERY, {
        after,
        first: PAGE_SIZE_LINEAR,
        filter: Object.keys(filter).length ? filter : undefined,
        includeArchived: archived,
      }, token);

      const rows: LinearDocumentInsert[] = data.documents.nodes.map(documentToRow);
      await batchInsertLinearDocument(rows, db);

      const nextAfter = data.documents.pageInfo.hasNextPage
        ? (data.documents.pageInfo.endCursor ?? null)
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
