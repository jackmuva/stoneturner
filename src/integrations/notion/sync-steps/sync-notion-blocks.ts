import { MAX_WORKERS, PAGE_SIZE } from "@/lib/constants";
import { appendNotionBlockChildren, batchInsertNotionBlock, getNotionBlockById, getNotionPages } from "../db/queries";
import type { NotionBlockInsert, NotionPageSelect } from "../db/schema";
import { getNotionCredentials, handleNotionRefresh, NOTION_BASE_API, NOTION_VERSION } from "./notion-utils";
import { upsertSyncTask } from "@/core/db/queries/queries";
import type { IntegrationCredential } from "@/core/db/schema/schema";
import type { NotionBlocks } from "../models/models";

export const syncNotionBlocks = async (incremental?: { lastEditedDate: string | null }, cursor?: string) => {
  let curOffset: number = 0;
  let notionPages: NotionPageSelect[] = await getNotionPages(curOffset);

  while (notionPages.length > 0) {
    let notionPageIndex = 0;
    while (notionPageIndex < notionPages.length) {
      let workerQueue: NotionPageSelect[] = [];
      while (workerQueue.length < MAX_WORKERS && notionPageIndex < notionPages.length) {
        if (incremental) {
          if (notionPages[notionPageIndex]?.lastEditedTime && notionPages[notionPageIndex]!.lastEditedTime! >= incremental!.lastEditedDate) {
            workerQueue.push(notionPages[notionPageIndex]!);
          }
        } else {
          workerQueue.push(notionPages[notionPageIndex]!);
        }
        notionPageIndex += 1;
      }
      await Promise.allSettled(workerQueue.map((page) => {
        return syncNotionBlocksById(page.pageId);
      }));
    }
    curOffset += PAGE_SIZE;
    notionPages = await getNotionPages(curOffset);
  }
}

const syncNotionBlocksById = async (blockId: string, nextCursor?: string) => {
  const url = nextCursor
    ? `${NOTION_BASE_API}/blocks/${blockId}/children?start_cursor=${nextCursor}`
    : `${NOTION_BASE_API}/blocks/${blockId}/children`;

  let cred = await getNotionCredentials();
  if (!cred?.accessToken) throw new Error("Missing Notion credential");
  let res = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${cred.accessToken}`,
      "Notion-Version": NOTION_VERSION,
    },
  });

  if (!res.ok) {
    await handleNotionRefresh();
    cred = await getNotionCredentials();
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

  const notionBlock = await res.json() as NotionBlocks;
  const childrenBlockIds = notionBlock.results.map((child) => child.id);

  const childBlocks: NotionBlockInsert[] = notionBlock.results.map((childBlock) => ({
    blockId: childBlock.id,
    type: childBlock.type,
    hasChildren: childBlock.has_children,
    // text: parseNotionText(childBlock),
    lastEditedTime: childBlock.last_edited_time,
  }));
  if (childBlocks.length > 0) {
    await batchInsertNotionBlock(childBlocks);
  }
  await appendNotionBlockChildren(blockId, childrenBlockIds, {
    nextCursor: notionBlock.next_cursor,
    hasMore: notionBlock.has_more,
  });

  if (notionBlock.has_more && notionBlock.next_cursor) {
    await syncNotionBlocksById(blockId, notionBlock.next_cursor);
  }

  for (const childBlock of notionBlock.results) {
    if (childBlock.has_children) {
      await syncNotionBlocksById(childBlock.id);
    }
  }
}
