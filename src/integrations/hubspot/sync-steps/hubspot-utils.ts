import { getIntegrationCredentialByIntegration, upsertIntegrationCredential, upsertSyncTask } from "@/core/db/queries/queries";
import type { IntegrationCredential } from "@/core/db/schema/schema";
import type { SqliteDb } from "@/core/models/db-models";
import { retry } from "@/lib/utils";
import Bottleneck from "bottleneck";
import type { BunRequest } from "bun";
import type { HubspotListResponse, HubspotSearchResponse, HubspotSyncCursor, HubspotTokenResponse } from "../models/models";

export const HUBSPOT_API = "https://api.hubapi.com";
export const HUBSPOT_TOKEN_URL = `${HUBSPOT_API}/oauth/v3/token`;
export const HUBSPOT_PAGE_SIZE = 100;

export const HUBSPOT_CONTACT_PROPERTIES = [
  "firstname", "lastname", "email", "phone", "company", "jobtitle",
  "lifecyclestage", "createdate", "lastmodifieddate",
];

export const HUBSPOT_COMPANY_PROPERTIES = [
  "name", "domain", "industry", "phone", "city", "state", "country",
  "createdate", "hs_lastmodifieddate",
];

export const HUBSPOT_DEAL_PROPERTIES = [
  "dealname", "amount", "dealstage", "pipeline", "closedate",
  "createdate", "hs_lastmodifieddate",
];

export const hubspotApiBottleneck = new Bottleneck({
  maxConcurrent: 1,
  minTime: 200,
});

export const getHubspotCredentials = async (db: SqliteDb): Promise<IntegrationCredential | undefined> => {
  return await getIntegrationCredentialByIntegration("hubspot", db);
};

const exchangeToken = async (body: URLSearchParams): Promise<HubspotTokenResponse | null> => {
  const clientId = process.env.BUN_PUBLIC_HUBSPOT_CLIENT_ID ?? "";
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET ?? "";

  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      ...Object.fromEntries(body.entries()),
    }),
  });

  if (!res.ok) return null;
  return await res.json() as HubspotTokenResponse;
};

const persistHubspotToken = async (
  cred: { id: string; refreshToken?: string | null },
  token: HubspotTokenResponse,
  db: SqliteDb,
): Promise<void> => {
  const tokenExpiration = new Date(Date.now() + token.expires_in * 1000).toISOString();
  await upsertIntegrationCredential({
    id: cred.id,
    integration: "hubspot",
    integrationType: "OAUTH",
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? cred.refreshToken,
    tokenExpiration,
  }, db);
};

export const handleHubspotRefresh = async (db: SqliteDb, syncTaskId?: string): Promise<void> => {
  const cred = await getHubspotCredentials(db);
  if (!cred?.refreshToken) return;

  const token = await exchangeToken(new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: cred.refreshToken,
  }));

  if (!token) {
    await upsertSyncTask({
      id: syncTaskId,
      integration: "hubspot",
      status: "FAILED",
      step: "hubspot-token-revalidation",
      error: "refresh failed",
    }, db);
    return;
  }

  await persistHubspotToken(cred, token, db);
};

export const handleOauthRedirect = async (req: BunRequest, db: SqliteDb): Promise<Response> => {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) {
    return Response.json({ error: "missing code" }, { status: 400 });
  }

  const redirectUri = `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/hubspot`;
  const token = await exchangeToken(new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  }));

  if (!token) {
    return Response.json({ error: "token exchange failed" }, { status: 502 });
  }

  await persistHubspotToken({ id: crypto.randomUUID() }, token, db);
  return Response.redirect(process.env.BUN_PUBLIC_BACKEND_BASE_URL!, 302);
};

export const hubspotFetch = async (path: string, db: SqliteDb, init?: RequestInit): Promise<Response> => {
  const doFetch = async (): Promise<Response> => {
    const cred = await getHubspotCredentials(db);
    if (!cred?.accessToken) throw new Error("Missing HubSpot credential");

    return await fetch(`${HUBSPOT_API}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...init?.headers,
        Authorization: `Bearer ${cred.accessToken}`,
      },
    });
  };

  let res = await hubspotApiBottleneck.schedule(() => doFetch());

  if (res.status === 401) {
    await handleHubspotRefresh(db);
    res = await hubspotApiBottleneck.schedule(() => doFetch());
  }

  return res;
};

export const toHubspotMs = (iso: string): string => String(new Date(iso).getTime());

export const maxModifiedMs = (
  objects: { properties: Record<string, string | null> }[],
  modifiedProperty: string,
  current?: string,
): string | undefined => {
  let max = current ? Number(current) : undefined;
  for (const obj of objects) {
    const raw = obj.properties[modifiedProperty];
    if (!raw) continue;
    const ms = Number(raw);
    if (!Number.isFinite(ms)) continue;
    if (max === undefined || ms > max) max = ms;
  }
  return max === undefined ? current : String(max);
};

export const fetchHubspotListPage = async (
  objectType: string,
  properties: string[],
  after: string | undefined,
  db: SqliteDb,
): Promise<HubspotListResponse> => {
  const url = new URL(`${HUBSPOT_API}/crm/v3/objects/${objectType}`);
  url.searchParams.set("limit", String(HUBSPOT_PAGE_SIZE));
  url.searchParams.set("properties", properties.join(","));
  if (after) url.searchParams.set("after", after);

  const res = await retry(async () => await hubspotFetch(url.pathname + url.search, db));
  if (!res.ok) throw new Error(`HubSpot ${res.status}: ${await res.text()}`);
  return await res.json() as HubspotListResponse;
};

export const searchHubspotPage = async (
  objectType: string,
  properties: string[],
  modifiedProperty: string,
  watermarkMs: string,
  after: string | undefined,
  db: SqliteDb,
): Promise<{ response: HubspotSearchResponse; hitSearchLimit: boolean }> => {
  const res = await retry(async () => await hubspotFetch(`/crm/v3/objects/${objectType}/search`, db, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filterGroups: [{
        filters: [{
          propertyName: modifiedProperty,
          operator: "GTE",
          value: watermarkMs,
        }],
      }],
      sorts: [{ propertyName: modifiedProperty, direction: "ASCENDING" }],
      properties,
      limit: HUBSPOT_PAGE_SIZE,
      ...(after ? { after } : {}),
    }),
  }));

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 400 && (text.includes("10,000") || text.toLowerCase().includes("search limit"))) {
      return { response: { results: [] }, hitSearchLimit: true };
    }
    throw new Error(`HubSpot ${res.status}: ${text}`);
  }

  return { response: await res.json() as HubspotSearchResponse, hitSearchLimit: false };
};

export type HubspotSyncInputs = { cursor?: HubspotSyncCursor };

export type HubspotObjectSyncConfig<TRow> = {
  objectType: "contacts" | "companies" | "deals";
  step: string;
  modifiedProperty: "lastmodifieddate" | "hs_lastmodifieddate";
  properties: string[];
  getLatestModified: (db: SqliteDb) => Promise<string | null>;
  batchInsert: (rows: TRow[], db: SqliteDb) => Promise<void>;
  mapRow: (obj: HubspotListResponse["results"][number]) => TRow;
};

export const syncHubspotObject = async <TRow>(
  incremental: boolean,
  db: SqliteDb,
  config: HubspotObjectSyncConfig<TRow>,
  inputs?: HubspotSyncInputs,
  syncTaskId?: string,
): Promise<void> => {
  const cursor = inputs?.cursor;
  let after = cursor?.after;
  let watermarkMs = cursor?.watermarkMs;

  if (incremental && !watermarkMs) {
    const latest = await config.getLatestModified(db);
    if (latest) watermarkMs = toHubspotMs(latest);
  }

  const useSearch = incremental && !!watermarkMs;

  while (true) {
    try {
      let results: HubspotListResponse["results"];
      let nextAfter: string | undefined;

      if (useSearch) {
        const { response, hitSearchLimit } = await searchHubspotPage(
          config.objectType,
          config.properties,
          config.modifiedProperty,
          watermarkMs!,
          after,
          db,
        );

        if (hitSearchLimit) {
          after = undefined;
          continue;
        }

        results = response.results;
        nextAfter = response.paging?.next?.after;
        watermarkMs = maxModifiedMs(results, config.modifiedProperty, watermarkMs) ?? watermarkMs;
      } else {
        const response = await fetchHubspotListPage(config.objectType, config.properties, after, db);
        results = response.results;
        nextAfter = response.paging?.next?.after;
      }

      await config.batchInsert(results.map(config.mapRow), db);

      const nextCursor: HubspotSyncCursor = useSearch
        ? { watermarkMs, ...(nextAfter ? { after: nextAfter } : {}) }
        : { ...(nextAfter ? { after: nextAfter } : {}) };

      await upsertSyncTask({
        id: syncTaskId,
        integration: "hubspot",
        status: "SUCCESS",
        error: null,
        step: config.step,
        inputs: Object.keys(nextCursor).length ? { cursor: nextCursor } : {},
      }, db);

      if (!nextAfter) break;
      after = nextAfter;
      if (inputs?.cursor !== undefined) break;
    } catch (e) {
      const failedCursor: HubspotSyncCursor = useSearch
        ? { watermarkMs: watermarkMs!, ...(after ? { after } : {}) }
        : { ...(after ? { after } : {}) };

      await upsertSyncTask({
        id: syncTaskId,
        integration: "hubspot",
        status: "FAILED",
        step: config.step,
        inputs: Object.keys(failedCursor).length ? { cursor: failedCursor } : {},
        error: String(e),
      }, db);
      break;
    }
  }
};
