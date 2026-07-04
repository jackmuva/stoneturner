import {
  getIntegrationCredentialByIntegration,
  upsertIntegrationCredential,
  upsertSyncTask,
} from "@/core/db/queries/queries";
import type { IntegrationCredential } from "@/core/db/schema/schema";
import type { SqliteDb } from "@/core/models/db-models";
import { retry } from "@/lib/utils";
import Bottleneck from "bottleneck";
import type { BunRequest } from "bun";
import type { GmailTokenResponse } from "../models/models";

export const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const gmailApiBottleneck = new Bottleneck({
  maxConcurrent: 5,
  minTime: 200,
});

export const getGmailCredentials = async (db: SqliteDb): Promise<IntegrationCredential | undefined> => {
  return await getIntegrationCredentialByIntegration("gmail", db);
};

export const getGmailSearchQuery = async (db: SqliteDb): Promise<string> => {
  const cred = await getGmailCredentials(db);
  const query = cred?.options?.query?.trim();
  return query || "in:inbox";
};

const tokenExpirationFromResponse = (expiresIn: number): string => {
  return new Date(Date.now() + expiresIn * 1000).toISOString();
};

export const handleGmailRefresh = async (db: SqliteDb): Promise<void> => {
  const cred = await getGmailCredentials(db);
  if (!cred?.refreshToken) return;

  const clientId = process.env.BUN_PUBLIC_GMAIL_CLIENT_ID ?? "";
  const clientSecret = process.env.GMAIL_CLIENT_SECRET ?? "";

  const res = await fetch(GOOGLE_TOKEN_URL, {
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
      integration: "gmail",
      status: "FAILED",
      inputs: { error: await res.text() },
      step: "gmail-token-revalidation",
    }, db);
    return;
  }

  const token = await res.json() as GmailTokenResponse;

  await upsertIntegrationCredential({
    id: cred.id,
    integration: "gmail",
    integrationType: "OAUTH",
    accessToken: token.access_token,
    refreshToken: cred.refreshToken,
    tokenExpiration: tokenExpirationFromResponse(token.expires_in),
  }, db);
};

export const handleOauthRedirect = async (req: BunRequest, db: SqliteDb): Promise<Response> => {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) {
    return Response.json({ error: "missing code" }, { status: 400 });
  }

  const clientId = process.env.BUN_PUBLIC_GMAIL_CLIENT_ID ?? "";
  const clientSecret = process.env.GMAIL_CLIENT_SECRET ?? "";
  const redirectUri = `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/gmail`;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    return Response.json({ error: "token exchange failed" }, { status: 502 });
  }

  const token = await res.json() as GmailTokenResponse;
  const existing = await getGmailCredentials(db);

  await upsertIntegrationCredential({
    id: existing?.id ?? crypto.randomUUID(),
    integration: "gmail",
    integrationType: "OAUTH",
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? existing?.refreshToken ?? null,
    tokenExpiration: tokenExpirationFromResponse(token.expires_in),
    options: existing?.options ?? null,
  }, db);

  return Response.redirect(process.env.BUN_PUBLIC_BACKEND_BASE_URL!, 302);
};

export const gmailFetch = async (path: string, token: string): Promise<Response> => {
  const url = path.startsWith("http") ? path : `${GMAIL_API}${path}`;
  return await gmailApiBottleneck.schedule(() =>
    retry(async () =>
      await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      }),
    ),
  );
};

export const gmailFetchJson = async <T>(path: string, db: SqliteDb): Promise<T> => {
  let cred = await getGmailCredentials(db);
  if (!cred?.accessToken) throw new Error("Missing Gmail credential");

  let res = await gmailFetch(path, cred.accessToken);
  if (res.status === 401) {
    await handleGmailRefresh(db);
    cred = await getGmailCredentials(db);
    if (!cred?.accessToken) throw new Error("Missing Gmail credential after refresh");
    res = await gmailFetch(path, cred.accessToken);
  }

  if (!res.ok) throw new Error(`Gmail ${res.status} for ${path}: ${await res.text()}`);
  return (await res.json()) as T;
};

export const internalDateToAfterQuery = (internalDate: string): string => {
  const date = new Date(Number(internalDate));
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
};

export const decodeBase64Url = (data: string): string => {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
};

export const stripHtml = (html: string): string => {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const getHeader = (headers: { name?: string; value?: string }[] | undefined, name: string): string => {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
};

export const extractBodyText = (part: import("../models/models").GmailMessagePart | undefined): string => {
  if (!part) return "";

  if (part.body?.data) {
    const decoded = decodeBase64Url(part.body.data);
    if (part.mimeType === "text/html") return stripHtml(decoded);
    return decoded;
  }

  const parts = part.parts ?? [];
  const plain = parts.find((p) => p.mimeType === "text/plain");
  if (plain) return extractBodyText(plain);

  const html = parts.find((p) => p.mimeType === "text/html");
  if (html) return extractBodyText(html);

  return parts.map((p) => extractBodyText(p)).filter(Boolean).join("\n\n");
};

export const messageToInsert = (message: import("../models/models").GmailMessage): import("../db/schema").GmailMessageInsert => {
  const headers = message.payload?.headers;
  const bodyText = extractBodyText(message.payload) || message.snippet || "";

  return {
    messageId: message.id,
    threadId: message.threadId,
    subject: getHeader(headers, "Subject"),
    fromAddress: getHeader(headers, "From"),
    toAddress: getHeader(headers, "To"),
    ccAddress: getHeader(headers, "Cc"),
    dateHeader: getHeader(headers, "Date"),
    internalDate: message.internalDate ?? null,
    snippet: message.snippet ?? null,
    bodyText,
    labelIds: message.labelIds ?? null,
    historyId: message.historyId ?? null,
  };
};

export const buildListQuery = (baseQuery: string, incremental: boolean, latestInternalDate: string | null): string => {
  if (!incremental || !latestInternalDate) return baseQuery;

  const afterClause = `after:${internalDateToAfterQuery(latestInternalDate)}`;
  return baseQuery ? `${baseQuery} ${afterClause}` : afterClause;
};
