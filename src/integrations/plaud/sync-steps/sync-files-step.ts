import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { PAGE_SIZE } from "@/lib/constants";
import { batchInsertPlaudFile, getLatestPlaudFile } from "../db/queries";
import type { PlaudFileInsert } from "../db/schema";
import type { PlaudFileListResponse } from "../models/models";
import { PLAUD_BASE_API, getPlaudCredentials, handlePlaudRefresh } from "./plaud-utils";
import type { SqliteDb } from "@/core/models/db-models";

export const syncPlaudFilesStep = async (incremental: boolean = false, db: SqliteDb, _inputs?: unknown, syncTaskId?: string): Promise<void> => {
  let latestStartAt: string | null = null;
  if (incremental) {
    const latest = await getLatestPlaudFile(db);
    latestStartAt = latest?.startAt ?? null;
  }

  let page = 1;
  while (true) {
    let response: PlaudFileListResponse;
    try {
      response = await retry(async () => await getFilesPage(page, db));
    } catch (e) {
      await upsertSyncTask({
        id: syncTaskId,
        integration: "plaud",
        status: "FAILED",
        step: "plaud-sync-files",
        inputs: { page },
        error: String(e),
      }, db);
      break;
    }

    const items = response.data ?? [];

    // Incremental: only keep files newer than the latest one already stored.
    const fresh = latestStartAt
      ? items.filter((f) => f.start_at > latestStartAt!)
      : items;

    try {
      const rows: PlaudFileInsert[] = fresh.map((f) => ({
        fileId: f.id,
        name: f.name,
        createdAt: f.created_at,
        serialNumber: f.serial_number,
        startAt: f.start_at,
        duration: f.duration,
      }));
      await batchInsertPlaudFile(rows, db);
      await upsertSyncTask({
        id: syncTaskId,
        integration: "plaud",
        status: "SUCCESS",
        step: "plaud-sync-files",
        inputs: { page },
      }, db);
    } catch (e) {
      await upsertSyncTask({
        id: syncTaskId,
        integration: "plaud",
        status: "FAILED",
        step: "plaud-sync-files",
        inputs: { page },
        error: String(e),
      }, db);
    }

    // Stop on a short/empty page, or once incremental hit already-synced files.
    if (items.length < PAGE_SIZE) break;
    if (incremental && fresh.length < items.length) break;
    page += 1;
  }
}

const getFilesPage = async (page: number, db: SqliteDb): Promise<PlaudFileListResponse> => {
  const url = new URL(`${PLAUD_BASE_API}/open/third-party/files/`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(PAGE_SIZE));

  let cred = await getPlaudCredentials(db);
  if (!cred?.accessToken) throw new Error("Missing Plaud credential");

  let res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${cred.accessToken}` },
  });

  if (!res.ok) {
    await handlePlaudRefresh(db);
    cred = await getPlaudCredentials(db);
    if (!cred?.accessToken) throw new Error("Missing Plaud credential");
    res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${cred.accessToken}` },
    });
    if (!res.ok) throw new Error(await res.text());
  }

  return await res.json() as PlaudFileListResponse;
}
