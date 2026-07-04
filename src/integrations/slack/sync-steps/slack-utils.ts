import { getIntegrationCredentialByIntegration, upsertIntegrationCredential } from "@/core/db/queries/queries";
import Bottleneck from "bottleneck";
import type { BunRequest } from "bun";
import type { SlackMessage, SlackOAuthAccessResponse } from "../models/models";
import { batchInsertSlackTeam } from "../db/queries";
import type { SqliteDb } from "@/core/models/db-models";
import type { SlackMessageInsert } from "../db/schema";

export const slackApiBottleneck = new Bottleneck({
  maxConcurrent: 3,
  minTime: 1000,
});

export const SLACK_API_ENDPOINT = "https://slack.com/api";

export const SKIPPED_MESSAGE_SUBTYPES = new Set([
  "channel_join",
  "channel_leave",
  "channel_topic",
  "channel_purpose",
  "channel_name",
  "channel_archive",
  "channel_unarchive",
  "group_join",
  "group_leave",
  "pinned_item",
  "unpinned_item",
]);

export const slackMessageId = (channelId: string, ts: string) => `${channelId}-${ts}`;

export const slackTsToIso = (ts: string) => new Date(Number.parseFloat(ts) * 1000).toISOString();

export const shouldPersistSlackMessage = (message: SlackMessage): boolean => {
  if (message.type !== "message") return false;
  if (message.subtype && SKIPPED_MESSAGE_SUBTYPES.has(message.subtype)) return false;
  return Boolean(message.text?.trim() || message.attachments?.length || message.blocks?.length);
};

export const toSlackMessageInsert = (
  message: SlackMessage,
  channelId: string,
  isReply: boolean,
): SlackMessageInsert => ({
  id: slackMessageId(channelId, message.ts),
  channelId,
  ts: message.ts,
  userId: message.user ?? null,
  text: message.text ?? "",
  threadTs: message.thread_ts ?? null,
  isReply,
  replyCount: message.reply_count ?? null,
  latestReply: message.latest_reply ?? null,
  subtype: message.subtype ?? null,
  editedTs: message.edited?.ts ?? null,
  reactions: message.reactions ?? null,
  attachments: message.attachments ?? null,
  blocks: message.blocks ?? null,
  botId: message.bot_id ?? null,
});

export const getSlackAccessToken = async (db: SqliteDb): Promise<string> => {
  const credential = await getIntegrationCredentialByIntegration("slack", db);
  if (!credential?.accessToken) {
    throw new Error("no slack access token available");
  }
  return credential.accessToken;
};

export const slackApiFetch = async <T>(
  method: string,
  token: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<T & { ok: boolean; error?: string; response_metadata?: { next_cursor?: string } }> => {
  const url = new URL(`${SLACK_API_ENDPOINT}/${method}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.json() as T & { ok: boolean; error?: string; response_metadata?: { next_cursor?: string } };
  if (!body.ok) {
    throw new Error(`slack ${method} failed: ${body.error ?? res.status}`);
  }
  return body;
};

export const refreshSlackTokens = async (db: SqliteDb) => {
  const credential = await getIntegrationCredentialByIntegration("slack", db);
  if (!credential?.refreshToken) return;

  const clientId = process.env.BUN_PUBLIC_SLACK_CLIENT_ID ?? "";
  const clientSecret = process.env.SLACK_CLIENT_SECRET ?? "";

  const res = await fetch(`${SLACK_API_ENDPOINT}/oauth.v2.access`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credential.refreshToken,
    }).toString(),
  });

  if (!res.ok) {
    throw new Error("slack token refresh failed");
  }

  const token = await res.json() as SlackOAuthAccessResponse;
  if (!token.ok || !token.access_token) {
    throw new Error("slack token refresh failed");
  }

  const tokenExpiration = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : credential.tokenExpiration;

  await upsertIntegrationCredential({
    ...credential,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? credential.refreshToken,
    tokenExpiration,
  }, db);
};

export const handleOauthRedirect = async (req: BunRequest, db: SqliteDb) => {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) {
    return Response.json({ error: "missing code" }, { status: 400 });
  }

  const clientId = process.env.BUN_PUBLIC_SLACK_CLIENT_ID ?? "";
  const clientSecret = process.env.SLACK_CLIENT_SECRET ?? "";
  const redirectUri = `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/slack`;

  const res = await fetch(`${SLACK_API_ENDPOINT}/oauth.v2.access`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!res.ok) {
    return Response.json({ error: "token exchange failed" }, { status: 502 });
  }

  const token = await res.json() as SlackOAuthAccessResponse;
  if (!token.ok || !token.authed_user?.access_token || !token.team) {
    return Response.json({ error: "missing user access token" }, { status: 502 });
  }

  const tokenExpiration = token.authed_user.expires_in
    ? new Date(Date.now() + token.authed_user.expires_in * 1000).toISOString()
    : null;

  await upsertIntegrationCredential({
    id: crypto.randomUUID(),
    integration: "slack",
    integrationType: "OAUTH",
    accessToken: token.authed_user.access_token,
    refreshToken: token.authed_user.refresh_token ?? null,
    baseUrl: SLACK_API_ENDPOINT,
    tokenExpiration,
  }, db);

  await batchInsertSlackTeam([{
    id: token.team.id,
    name: token.team.name,
    domain: null,
    enterpriseId: token.enterprise?.id ?? null,
    isEnterpriseInstall: token.is_enterprise_install ?? false,
  }], db);

  return Response.redirect(process.env.BUN_PUBLIC_BACKEND_BASE_URL!, 302);
};
