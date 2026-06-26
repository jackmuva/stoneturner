import type { NotionPage } from "../models/models";
import { NOTION_BASE_API, NOTION_VERSION, getNotionCredentials, handleNotionRefresh } from "./notion-utils";
import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { PAGE_SIZE } from "@/lib/constants";
import { batchInsertNotionPage } from "../db/queries";
import type { NotionPageInsert } from "../db/schema";

type NotionSearchResponse = {
  object: "list",
  results: NotionPage[],
  has_more: boolean,
  next_cursor: string | null,
};

export const syncNotionPages = async (incremental: boolean = false, cursor?: string) => {
  let nextCursor: string | undefined = cursor;

  while (true) {
    let response: NotionSearchResponse | null = null;
    try {
      response = await retry(async () => {
        return await getPage(nextCursor);
      }, 3, 1);
    } catch (e) {
      await upsertSyncTask({
        integration: "notion",
        status: "FAILED",
        step: "notion-sync-pages",
        inputs: { cursor: nextCursor, error: e },
      })
      break;
    }
    try {
      await upsertPages(response.results);
      if (!response.has_more || !response.next_cursor) break;
      nextCursor = response.next_cursor;
      await upsertSyncTask({
        integration: "notion",
        status: "SUCCESS",
        step: "notion-sync-pages",
        inputs: { cursor: nextCursor },
      });
    } catch (e) {
      await upsertSyncTask({
        integration: "notion",
        status: "FAILED",
        step: "notion-sync-pages",
        inputs: { cursor: nextCursor, error: e },
      })
      if (!response.next_cursor) break;
    }
  }
  return;
}

const upsertPages = async (pages: NotionPage[]): Promise<void> => {
  if (pages.length === 0) return;

  const rows: NotionPageInsert[] = pages.map((page) => ({
    pageId: page.id,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
    createdBy: page.created_by,
    lastEditedBy: page.last_edited_by,
    archived: page.archived,
    inTrash: page.in_trash,
    icon: page.icon,
    cover: page.cover,
    properties: page.properties,
    parent: page.parent,
    url: page.url,
    publicUrl: page.public_url,
  }));
  await batchInsertNotionPage(rows);

  return;
}

export const getPage = async (cursor?: string): Promise<NotionSearchResponse> => {
  let cred = await getNotionCredentials();
  if (!cred?.accessToken) throw new Error("Missing Notion credential");
  let res = await fetch(`${NOTION_BASE_API}/search`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${cred.accessToken}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: { property: "object", value: "page" },
      sort: { direction: "descending", timestamp: "last_edited_time" },
      page_size: PAGE_SIZE,
      ...(cursor ? { start_cursor: cursor } : {}),
    }),
  });

  if (!res.ok) {
    await handleNotionRefresh();
    cred = await getNotionCredentials();
    if (!cred?.accessToken) throw new Error("Missing Notion credential");
    res = await fetch(`${NOTION_BASE_API}/search`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cred.accessToken}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: { property: "object", value: "page" },
        sort: { direction: "descending", timestamp: "last_edited_time" },
        page_size: PAGE_SIZE,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    })
    if (!res.ok) throw new Error(JSON.stringify(await res.json()));
  }
  const pages = await res.json() as NotionSearchResponse;
  return pages;
}
