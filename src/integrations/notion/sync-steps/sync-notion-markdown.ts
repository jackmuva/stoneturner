import { PAGE_SIZE } from "@/lib/constants";
import type { NotionPageMarkdownInsert, NotionPageSelect } from "../db/schema";
import { batchInsertNotionPageMarkdown, getNotionPages, getMostRecentEditedTime } from "../db/queries";
import { getNotionCredentials, handleNotionRefresh, NOTION_BASE_API, NOTION_VERSION, notionApiBottleneck } from "./notion-utils";
import { upsertSyncTask } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";
import type { NotionPageMarkdown } from "../models/models";

export type NotionSyncMarkdownInputs = { offset?: number };

export const syncNotionMarkdown = async (incremental: boolean = false, db: SqliteDb, inputs?: NotionSyncMarkdownInputs, syncTaskId?: string) => {
  const lastEditedDate = incremental ? await getMostRecentEditedTime(db) : null;
  const offset = inputs?.offset;
  let curOffset: number = offset ?? 0;
  let notionPages: NotionPageSelect[] = await getNotionPages(curOffset, db);

  while (notionPages.length > 0) {
    const workerQueue = notionPages.filter((page) =>
      !incremental || !lastEditedDate ||
      (page.lastEditedTime !== null && page.lastEditedTime >= lastEditedDate)
    );
    try {
      const markdownResults = await Promise.allSettled(workerQueue.map((page) =>
        notionApiBottleneck.schedule(async () => {
          const result = await retrievePageMarkdown(page.pageId, db);
          const record: NotionPageMarkdownInsert = {
            pageId: page.pageId,
            object: result.object,
            markdown: result.markdown,
            truncated: result.truncated,
            unknownBlockIds: result.unknown_block_ids,
            lastEditedTime: page.lastEditedTime,
          };
          await batchInsertNotionPageMarkdown([record], db);
        })
      ));

      const failures = markdownResults
        .filter((r) => r.status === "rejected")
        .map((r) => String((r as PromiseRejectedResult).reason));

      await upsertSyncTask({
        id: syncTaskId,
        integration: "notion",
        status: failures.length ? "FAILED" : "SUCCESS",
        step: "notion-sync-markdown",
        inputs: { offset: curOffset },
        error: failures.length ? JSON.stringify(failures) : undefined,
      }, db)
    } catch (e) {
      await upsertSyncTask({
        id: syncTaskId,
        integration: "notion",
        status: "FAILED",
        step: "notion-sync-markdown",
        inputs: { offset: curOffset },
        error: String(e),
      }, db)
    }
    if (offset !== undefined) break;
    curOffset += PAGE_SIZE;
    notionPages = await getNotionPages(curOffset, db);
  }
}

const retrievePageMarkdown = async (pageId: string, db: SqliteDb): Promise<NotionPageMarkdown> => {
  const url = `${NOTION_BASE_API}/pages/${pageId}/markdown`;

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

  const pageMarkdown = await res.json() as NotionPageMarkdown;
  if (pageMarkdown.truncated && pageMarkdown.unknown_block_ids?.length) {
    let markdown = pageMarkdown.markdown;
    for (const blockId of pageMarkdown.unknown_block_ids) {
      const subtree = await retrievePageMarkdown(blockId, db);
      markdown += `\n${subtree.markdown}`;
    }
    return { ...pageMarkdown, markdown };
  }

  return pageMarkdown;
}
