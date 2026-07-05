import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { getPlaudFilesWithoutTranscript, upsertPlaudTranscript } from "../db/queries";
import type { PlaudFileSelect } from "../db/schema";
import type { PlaudFileDetail, PlaudTranscriptSegment } from "../models/models";
import { PLAUD_BASE_API, getPlaudCredentials, handlePlaudRefresh, plaudApiBottleneck } from "./plaud-utils";
import type { SqliteDb } from "@/core/models/db-models";

export const syncPlaudTranscriptsStep = async (db: SqliteDb): Promise<void> => {
  let files: PlaudFileSelect[] = [];
  let firstIteration = true;

  // getPlaudFilesWithoutTranscript shrinks as we insert transcripts, so always
  // read from offset 0 — each pass picks up the next batch of un-synced files.
  while (files.length > 0 || firstIteration) {
    firstIteration = false;
    try {
      files = await getPlaudFilesWithoutTranscript(0, db);
      if (files.length === 0) break;

      const results = await Promise.allSettled(
        files.map((file) => plaudApiBottleneck.schedule(() => syncTranscript(file, db)))
      );
      const failures = results
        .filter((r) => r.status === "rejected")
        .map((r) => String((r as PromiseRejectedResult).reason));

      await upsertSyncTask({
        integration: "Plaud",
        status: failures.length ? "FAILED" : "SUCCESS",
        step: "plaud-sync-transcripts",
        inputs: failures.length ? { count: files.length, errors: failures } : { count: files.length },
      }, db);

      // Guard against an infinite loop if every file in the batch failed.
      if (failures.length === files.length) break;
    } catch (e) {
      await upsertSyncTask({
        integration: "Plaud",
        status: "FAILED",
        step: "plaud-sync-transcripts",
        inputs: { error: String(e) },
      }, db);
      break;
    }
  }
}

const syncTranscript = async (file: PlaudFileSelect, db: SqliteDb): Promise<void> => {
  const detail = await retry(async () => await getFileDetail(file.fileId, db));

  const transactionSource = detail.source_list?.find((s) => s.data_type === "transaction");
  let segments: PlaudTranscriptSegment[] = [];
  if (transactionSource?.data_content) {
    try {
      segments = JSON.parse(transactionSource.data_content) as PlaudTranscriptSegment[];
    } catch {
      segments = [];
    }
  }

  await upsertPlaudTranscript([{
    fileId: file.fileId,
    name: file.name,
    segments,
  }], db);
}

const getFileDetail = async (fileId: string, db: SqliteDb): Promise<PlaudFileDetail> => {
  const url = `${PLAUD_BASE_API}/open/third-party/files/${fileId}`;

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

  return await res.json() as PlaudFileDetail;
}
