import { upsertSyncTask } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";
import { batchInsertGmailMessage, getLatestGmailMessage } from "../db/queries";
import type { GmailMessage, GmailMessagesListResponse } from "../models/models";
import {
  buildListQuery,
  getGmailSearchQuery,
  gmailFetchJson,
  messageToInsert,
} from "./gmail-utils";

const LIST_PAGE_SIZE = 100;

export const syncGmailMessagesStep = async (incremental: boolean = false, db: SqliteDb): Promise<void> => {
  let latestInternalDate: string | null = null;
  if (incremental) {
    const latest = await getLatestGmailMessage(db);
    latestInternalDate = latest?.internalDate ?? null;
  }

  const baseQuery = await getGmailSearchQuery(db);
  const listQuery = buildListQuery(baseQuery, incremental, latestInternalDate);

  let pageToken: string | undefined;
  let first = true;

  while (first || pageToken) {
    first = false;
    const params = new URLSearchParams({
      maxResults: String(LIST_PAGE_SIZE),
    });
    if (pageToken) params.set("pageToken", pageToken);
    if (listQuery) params.set("q", listQuery);

    let listResponse: GmailMessagesListResponse;
    try {
      listResponse = await gmailFetchJson<GmailMessagesListResponse>(
        `/users/me/messages?${params.toString()}`,
        db,
      );
    } catch (e) {
      await upsertSyncTask({
        integration: "gmail",
        status: "FAILED",
        step: "gmail-sync-messages",
        inputs: { pageToken, error: String(e) },
      }, db);
      break;
    }

    const items = listResponse.messages ?? [];
    const rows = [];

    for (const item of items) {
      try {
        const message = await gmailFetchJson<GmailMessage>(
          `/users/me/messages/${item.id}?format=full`,
          db,
        );
        rows.push(messageToInsert(message));
      } catch (e) {
        await upsertSyncTask({
          integration: "gmail",
          status: "FAILED",
          step: "gmail-sync-messages",
          inputs: { messageId: item.id, error: String(e) },
        }, db);
      }
    }

    try {
      await batchInsertGmailMessage(rows, db);
      await upsertSyncTask({
        integration: "gmail",
        status: "SUCCESS",
        step: "gmail-sync-messages",
        inputs: { pageToken, count: rows.length, query: listQuery },
      }, db);
    } catch (e) {
      await upsertSyncTask({
        integration: "gmail",
        status: "FAILED",
        step: "gmail-sync-messages",
        inputs: { pageToken, error: String(e) },
      }, db);
    }

    pageToken = listResponse.nextPageToken;
    if (items.length < LIST_PAGE_SIZE) break;
    if (incremental && items.length === 0) break;
  }
};
