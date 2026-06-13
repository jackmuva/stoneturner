import { upsertSyncTask } from "@/core/db/queries";
import { retry } from "@/lib/utils";
import { batchInsertGongTranscript, getLatestGongCall } from "../db/queries";
import type { GongTranscriptResponse } from "../models/models";
import type { GongTranscriptInsert } from "../db/schema";
import { getCredentials } from "./sync-calls-step";

export const syncGongTranscriptsStep = async (incremental: boolean = false) => {
  let latestDate: null | string = null;
  if (incremental) {
    const latestCall = await getLatestGongCall();
    if (latestCall) latestDate = latestCall.started;
  }

  const { basicToken, baseUrl } = await getCredentials();

  let curCursor: string | null | undefined = null;
  let firstIteration: boolean = true;
  while ((curCursor || firstIteration) && baseUrl) {
    firstIteration = false;
    curCursor = await fetchGongTranscripts(basicToken, baseUrl, curCursor, latestDate);
  }
}

const fetchGongTranscripts = async (basicToken: string, baseUrl: string, curCursor: string | null | undefined, latestDate: string | null): Promise<string | undefined | null> => {
  const url = new URL(`${baseUrl?.at(-1) === "/" ? baseUrl.slice(0, -1) : baseUrl}/v2/calls/transcript`);

  const gongReq: Response = await retry(async () => await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(curCursor ? {
      cursor: curCursor,
      filter: latestDate ? {
        startDateTime: latestDate
      } : {}
    } : {
      filter: latestDate ? {
        startDateTime: latestDate
      } : {}
    })
  }));

  if (!gongReq.ok) {
    await upsertSyncTask({
      integration: "Gong",
      status: "FAILED",
      inputs: JSON.stringify({
        cursor: curCursor,
        url: url.toString(),
      }),
      step: "sync-transcript"
    });
    return null;
  }

  const gongResponse: GongTranscriptResponse = (await gongReq.json()) as GongTranscriptResponse;

  const inserts: GongTranscriptInsert[] = gongResponse.callTranscripts.map(t => ({
    callId: t.callId,
    transcript: t.transcript,
  }));

  await batchInsertGongTranscript(inserts);

  await upsertSyncTask({
    integration: "Gong",
    status: "SUCCESS",
    inputs: JSON.stringify({ cursor: curCursor, url: url.toString() }),
    step: "sync-transcript"
  });

  return gongResponse.records.cursor;
}
