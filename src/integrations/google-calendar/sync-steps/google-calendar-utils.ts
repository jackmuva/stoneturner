import { getIntegrationCredentialByIntegration, upsertIntegrationCredential, upsertSyncTask } from "@/core/db/queries/queries";
import type { IntegrationCredential } from "@/core/db/schema/schema";
import type { GoogleTokenResponse } from "../models/models";
import Bottleneck from "bottleneck";
import type { BunRequest } from "bun";
import type { SqliteDb } from "@/core/models/db-models";

export const googleCalendarApiBottleneck = new Bottleneck({
  maxConcurrent: 5,
  minTime: 200,
});

export const GOOGLE_CALENDAR_BASE_API = "https://www.googleapis.com/calendar/v3";
export const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const getGoogleCalendarCredentials = async (db: SqliteDb): Promise<IntegrationCredential | undefined> => {
  return await getIntegrationCredentialByIntegration("google-calendar", db);
};

const tokenExpirationFromResponse = (expiresIn: number): string => {
  return new Date(Date.now() + expiresIn * 1000).toISOString();
};

export const handleGoogleCalendarRefresh = async (db: SqliteDb): Promise<void> => {
  const cred = await getGoogleCalendarCredentials(db);
  if (!cred?.refreshToken) return;

  const clientId = process.env.BUN_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "";

  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: cred.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    await upsertSyncTask({
      integration: "google-calendar",
      status: "FAILED",
      inputs: { error: await res.text() },
      step: "google-calendar-token-revalidation",
    }, db);
    return;
  }

  const token = await res.json() as GoogleTokenResponse;

  await upsertIntegrationCredential({
    id: cred.id,
    integration: "google-calendar",
    integrationType: "OAUTH",
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? cred.refreshToken,
    tokenExpiration: tokenExpirationFromResponse(token.expires_in),
  }, db);
};

export const handleOauthRedirect = async (req: BunRequest, db: SqliteDb): Promise<Response> => {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) {
    return Response.json({ error: "missing code" }, { status: 400 });
  }

  const clientId = process.env.BUN_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "";
  const redirectUri = `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/google-calendar`;

  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    return Response.json({ error: "token exchange failed" }, { status: 502 });
  }

  const token = await res.json() as GoogleTokenResponse;

  await upsertIntegrationCredential({
    id: crypto.randomUUID(),
    integration: "google-calendar",
    integrationType: "OAUTH",
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    tokenExpiration: tokenExpirationFromResponse(token.expires_in),
  }, db);

  return Response.redirect(process.env.BUN_PUBLIC_BACKEND_BASE_URL!, 302);
};

export const googleCalendarFetch = async (url: URL, db: SqliteDb): Promise<Response> => {
  let cred = await getGoogleCalendarCredentials(db);
  if (!cred?.accessToken) throw new Error("Missing Google Calendar credential");

  let res = await googleCalendarApiBottleneck.schedule(() =>
    fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${cred!.accessToken}` },
    }),
  );

  if (res.status === 401) {
    await handleGoogleCalendarRefresh(db);
    cred = await getGoogleCalendarCredentials(db);
    if (!cred?.accessToken) throw new Error("Missing Google Calendar credential after refresh");
    res = await googleCalendarApiBottleneck.schedule(() =>
      fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${cred!.accessToken}` },
      }),
    );
  }

  if (!res.ok) throw new Error(await res.text());
  return res;
};

export const twoYearsAgoIso = (): string => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 2);
  return date.toISOString();
};
