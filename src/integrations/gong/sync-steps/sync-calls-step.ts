import { getIntegrationCredentialByIntegration, upsertSyncTask } from "@/core/db/queries";
import type { IntegrationCredential } from "@/core/db/schema";
import { retry } from "@/lib/utils";
import { batchInsertGongCall, getLatestGongCall } from "../db/queries";
import type { GongCallResponse } from "../models/models";
import type { GongCallInsert } from "../db/schema";

export const syncGongCallsStep= async (incremental: boolean = false) => {
  let latestDate: null | string = null;
  if (incremental) {
    const latestCall = await getLatestGongCall();
    if (latestCall) latestDate = latestCall.started;
  }

  const { basicToken, baseUrl } = await getCredentials();

  let curCursor: string | null = null;
  let firstIteration: boolean = true;
  while ((curCursor || firstIteration) && baseUrl) {
    firstIteration = false;
    curCursor = await fetchGongCalls(basicToken, baseUrl, curCursor, latestDate);
  }
}

export const getCredentials = async (): Promise<{ basicToken: string, baseUrl: string | null | undefined }> => {
  const gongConfig: IntegrationCredential | undefined = await getIntegrationCredentialByIntegration("Gong");
  const basicToken: string = btoa(gongConfig?.accessKey + ":" + gongConfig?.secretKey);
  return {
    basicToken: basicToken,
    baseUrl: gongConfig?.baseUrl
  };
}

const fetchGongCalls = async (basicToken: string, baseUrl: string, curCursor: string | null, startDate: string | null): Promise<string | null> => {
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

  if (!gongReq.ok) {
    await upsertSyncTask({
      integration: "Gong",
      status: "FAILED",
      inputs: JSON.stringify({
        cursor: curCursor,
        url: url.toString(),
      }),
      step: "sync-call"
    });
    return null;
  }

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

  await batchInsertGongCall(inserts);

  await upsertSyncTask({
    integration: "Gong",
    status: "SUCCESS",
    inputs: JSON.stringify({ cursor: curCursor, url: `${baseUrl?.at(-1) === "/" ? baseUrl.slice(0, -1) : baseUrl}/v2/calls` }),
    step: "sync-call"
  });

  return gongResponse.records.cursor;
}
