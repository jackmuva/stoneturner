import { MAX_WORKERS, PAGE_SIZE } from "@/lib/constants";
import { getNotionPages } from "../db/queries";
import type { NotionPageSelect } from "../db/schema";
import { getNotionCredentials, handleNotionRefresh, NOTION_BASE_API, NOTION_VERSION } from "./notion-utils";
import { upsertSyncTask } from "@/core/db/queries/queries";
import type { IntegrationCredential } from "@/core/db/schema/schema";
import type { NotionBlocks } from "../models/models";

export const syncNotionBlocks = async (incremental: boolean = false, cursor?: string) => {
  let curOffset: number = 0;
  let notionPages: NotionPageSelect[] = await getNotionPages(curOffset);
  let notionPageIndex = 0;

  while (notionPages.length > 0) {
    const workerQueue: NotionPageSelect[] = [];
    while (notionPageIndex < notionPages.length) {
      while (workerQueue.length < MAX_WORKERS) {
        workerQueue.push(notionPages[notionPageIndex]!);
        notionPageIndex += 1;
      }
      await Promise.allSettled(workerQueue.map((page) => {
        return syncNotionBlocksById(page.pageId, true);
      }));
    }
    curOffset += PAGE_SIZE;
    notionPages = await getNotionPages(curOffset);
  }
}

const syncNotionBlocksById = async (blockId: string, isPage: boolean) => {
  let cred = await getNotionCredentials();
  if (!cred?.accessToken) throw new Error("Missing Notion credential");
  let res = await fetch(`${NOTION_BASE_API}/blocks/${blockId}/children`, {
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
    res = await fetch(`${NOTION_BASE_API}/blocks/${blockId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${cred.accessToken}`,
        "Notion-Version": NOTION_VERSION,
      },
    });
    if (!res.ok) throw new Error(JSON.stringify(await res.json()));
  }

  const blockChildren = await res.json() as NotionBlocks;
  blockChildren.results
  blockChildren.has_more
  blockChildren.next_cursor
}
