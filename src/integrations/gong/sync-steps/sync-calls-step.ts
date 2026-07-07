import { getIntegrationCredentialByIntegration, upsertSyncTask } from "@/core/db/queries/queries";
import type { IntegrationCredential } from "@/core/db/schema/schema";
import { retry } from "@/lib/utils";
import { batchInsertGongCall, getLatestGongCall } from "../db/queries";
import type { GongCallResponse } from "../models/models";
import type { GongCallInsert } from "../db/schema";
import type { SqliteDb } from "@/core/models/db-models";

export type GongSyncCallsInputs = { cursor?: string | null };

export const syncGongCallsStep = async (incremental: boolean = true, db: SqliteDb, inputs?: GongSyncCallsInputs, syncTaskId?: string) => {
  const cursor = inputs?.cursor;
  let latestDate: null | string = null;
  if (incremental) {
    const latestCall = await getLatestGongCall(db);
    if (latestCall) latestDate = latestCall.started;
  }

  const { basicToken, baseUrl } = await getCredentials(db);

  let curCursor: string | null = cursor ?? null;
  let firstIteration: boolean = true;
  while ((curCursor || firstIteration) && baseUrl) {
    firstIteration = false;
    curCursor = await fetchGongCalls(db, basicToken, baseUrl, curCursor, latestDate, syncTaskId);
    if (cursor) break;
  }
}

export const getCredentials = async (db: SqliteDb): Promise<{ basicToken: string, baseUrl: string | null | undefined }> => {
  const gongConfig: IntegrationCredential | undefined = await getIntegrationCredentialByIntegration("Gong", db);
  const basicToken: string = btoa(gongConfig?.accessKey + ":" + gongConfig?.secretKey);
  return {
    basicToken: basicToken,
    baseUrl: gongConfig?.baseUrl
  };
}

const fetchGongCalls = async (db: SqliteDb, basicToken: string, baseUrl: string, curCursor: string | null, startDate: string | null, syncTaskId?: string): Promise<string | null> => {
  try {
    const url = new URL(`${baseUrl?.at(-1) === "/" ? baseUrl.slice(0, -1) : baseUrl}/v2/calls`);
    if (curCursor) url.searchParams.append("cursor", curCursor);
    if (startDate) url.searchParams.append("fromDateTime", startDate);

    const gongReq: Response = await retry(async () => await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${basicToken}`,
        "Content-Type": "application/json",
      },
    }));

    const gongResponse: GongCallResponse = (await gongReq.json()) as GongCallResponse;

    const inserts: GongCallInsert[] = gongResponse.calls.map(t => ({
      callId: t.id,
      url: t.url,
      title: t.title,
      scheduled: t.scheduled,
      started: t.started,
      duration: String(t.duration),
      primaryUserId: t.primaryUserId,
      direction: t.direction,
      system: t.system,
      scope: t.scope,
      media: t.media,
      language: t.language,
      workspaceId: t.workspaceId,
      sdrDisposition: t.sdrDisposition,
      clientUniqueId: t.clientUniqueId,
      customData: t.customData,
      purpose: t.purpose,
      meetingUrl: t.meetingUrl,
      isPrivate: t.isPrivate,
      calendarEventId: t.calendarEventId,
    }));

    await batchInsertGongCall(inserts, db);

    await upsertSyncTask({
      id: syncTaskId,
      integration: "gong",
      status: "SUCCESS",
      error: null,
      inputs: { cursor: curCursor },
      step: "gong-sync-call"
    }, db);

    return gongResponse.records.cursor;
  } catch (e) {
    await upsertSyncTask({
      id: syncTaskId,
      integration: "gong",
      status: "FAILED",
      inputs: { cursor: curCursor },
      error: String(e),
      step: "gong-sync-call"
    }, db);
    return null;
  }
}
