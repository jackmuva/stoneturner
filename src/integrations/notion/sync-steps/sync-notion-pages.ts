import type { NotionChildPageBlock, NotionPage, NotionSearchResponse } from "../models/models";
import { NOTION_BASE_API, NOTION_VERSION, getNotionCredentials, handleNotionRefresh, notionApiBottleneck } from "./notion-utils";
import { upsertSyncTask } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";
import { retry } from "@/lib/utils";
import { PAGE_SIZE } from "@/lib/constants";
import { batchInsertNotionPage } from "../db/queries";
import type { NotionPageInsert } from "../db/schema";

export type NotionSyncPagesInputs = { cursor?: string };

export const syncNotionPages = async (incremental: boolean = false, db: SqliteDb, inputs?: NotionSyncPagesInputs, syncTaskId?: string) => {
  let nextCursor: string | undefined = inputs?.cursor;

  while (true) {
    let response: NotionSearchResponse | null = null;
    try {
      response = await retry(async () => {
        return await getPages(db, nextCursor);
      });
    } catch (e) {
      await upsertSyncTask({
        id: syncTaskId,
        integration: "notion",
        status: "FAILED",
        step: "notion-sync-pages",
        inputs: { cursor: nextCursor },
        error: String(e),
      }, db)
      break;
    }
    try {
      await upsertPages(response.results, db);
      if (!response.has_more || !response.next_cursor) break;
      nextCursor = response.next_cursor;
      await upsertSyncTask({
        id: syncTaskId,
        integration: "notion",
        status: "SUCCESS",
        step: "notion-sync-pages",
        inputs: { cursor: nextCursor },
      }, db);
    } catch (e) {
      await upsertSyncTask({
        id: syncTaskId,
        integration: "notion",
        status: "FAILED",
        step: "notion-sync-pages",
        inputs: { cursor: nextCursor },
        error: String(e),
      }, db)
      if (!response.next_cursor) break;
    }
  }
  return;
}

const upsertPages = async (pages: NotionPage[], db: SqliteDb): Promise<void> => {
  if (pages.length === 0) return;

  const titles = new Map<string, string | undefined>();
  await Promise.allSettled(pages.map((page) =>
    notionApiBottleneck.schedule(async () => {
      const title = await retry(async () => getPage(page.id, db));
      titles.set(page.id, title);
    })
  ));

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
    title: titles.get(page.id),
  }));
  await batchInsertNotionPage(rows, db);

  return;
}

export const getPages = async (db: SqliteDb, cursor?: string): Promise<NotionSearchResponse> => {
  let cred = await getNotionCredentials(db);
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
    await handleNotionRefresh(db);
    cred = await getNotionCredentials(db);
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

export const getPage = async (pageId: string, db: SqliteDb): Promise<string | undefined> => {
  const url = `${NOTION_BASE_API}/blocks/${pageId}`;

  let cred = await getNotionCredentials(db);
  if (!cred?.accessToken) throw new Error("Missing Notion credential");
  let res = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${cred.accessToken}`,
      "Notion-Version": NOTION_VERSION,
    },
  });

  if (!res.ok) {
    await handleNotionRefresh(db);
    cred = await getNotionCredentials(db);
    if (!cred?.accessToken) throw new Error("Missing Notion credential");
    res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${cred.accessToken}`,
        "Notion-Version": NOTION_VERSION,
      },
    });
    if (!res.ok) throw new Error(JSON.stringify(await res.json()));
  }

  const block = await res.json() as NotionChildPageBlock;
  return block.type === "child_page" ? block.child_page?.title : undefined;
}
