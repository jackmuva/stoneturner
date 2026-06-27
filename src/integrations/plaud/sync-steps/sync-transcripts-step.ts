import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { getPlaudFilesWithoutTranscript, upsertPlaudTranscript } from "../db/queries";
import type { PlaudFileSelect } from "../db/schema";
import type { PlaudFileDetail, PlaudTranscriptSegment } from "../models/models";
import { PLAUD_BASE_API, getPlaudCredentials, handlePlaudRefresh, plaudApiBottleneck } from "./plaud-utils";

export const syncPlaudTranscriptsStep = async (): Promise<void> => {
  let files: PlaudFileSelect[] = [];
  let firstIteration = true;

  // getPlaudFilesWithoutTranscript shrinks as we insert transcripts, so always
  // read from offset 0 — each pass picks up the next batch of un-synced files.
  while (files.length > 0 || firstIteration) {
    firstIteration = false;
    try {
      files = await getPlaudFilesWithoutTranscript(0);
      if (files.length === 0) break;

      const results = await Promise.allSettled(
        files.map((file) => plaudApiBottleneck.schedule(() => syncTranscript(file)))
      );
      const failures = results
        .filter((r) => r.status === "rejected")
        .map((r) => String((r as PromiseRejectedResult).reason));

      await upsertSyncTask({
        integration: "Plaud",
        status: failures.length ? "FAILED" : "SUCCESS",
        step: "plaud-sync-transcripts",
        inputs: failures.length ? { count: files.length, errors: failures } : { count: files.length },
      });

      // Guard against an infinite loop if every file in the batch failed.
      if (failures.length === files.length) break;
    } catch (e) {
      await upsertSyncTask({
        integration: "Plaud",
        status: "FAILED",
        step: "plaud-sync-transcripts",
        inputs: { error: String(e) },
      });
      break;
    }
  }
}

const syncTranscript = async (file: PlaudFileSelect): Promise<void> => {
  const detail = await retry(async () => await getFileDetail(file.fileId), 3, 1);

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
  }]);
}

const getFileDetail = async (fileId: string): Promise<PlaudFileDetail> => {
  const url = `${PLAUD_BASE_API}/open/third-party/files/${fileId}`;

  let cred = await getPlaudCredentials();
  if (!cred?.accessToken) throw new Error("Missing Plaud credential");

  let res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${cred.accessToken}` },
  });

  if (!res.ok) {
    await handlePlaudRefresh();
    cred = await getPlaudCredentials();
    if (!cred?.accessToken) throw new Error("Missing Plaud credential");
    res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${cred.accessToken}` },
    });
    if (!res.ok) throw new Error(await res.text());
  }

  return await res.json() as PlaudFileDetail;
}
