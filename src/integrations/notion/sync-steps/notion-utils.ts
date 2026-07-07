import { getIntegrationCredentialByIntegration, upsertIntegrationCredential, upsertSyncTask } from "@/core/db/queries/queries";
import type { IntegrationCredential } from "@/core/db/schema/schema";
import type { SqliteDb } from "@/core/models/db-models";
import Bottleneck from "bottleneck";
import type { BunRequest } from "bun";

export const notionApiBottleneck = new Bottleneck({
  maxConcurrent: 1,
  minTime: 1000
});

export const NOTION_BASE_API = "https://api.notion.com/v1";
export const NOTION_VERSION = "2026-03-11";

export const getNotionCredentials = async (db: SqliteDb) => {
  return await getIntegrationCredentialByIntegration("notion", db);
}

export const handleNotionRefresh = async (db: SqliteDb, syncTaskId?: string) => {
  const cred: IntegrationCredential | undefined = await getIntegrationCredentialByIntegration("notion", db);
  if (!cred) return;

  const clientId = process.env.BUN_PUBLIC_NOTION_CLIENT_ID ?? "";
  const clientSecret = process.env.NOTION_CLIENT_SECRET ?? "";

  const res = await fetch(`${NOTION_BASE_API}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: cred.refreshToken,
    }),
  });

  if (!res.ok) {
    upsertSyncTask({
      id: syncTaskId,
      integration: "notion",
      status: "FAILED",
      step: "notion-token-revalidation",
      error: await res.text(),
    }, db)
  }

  const token = await res.json() as {
    access_token: string;
    refresh_token: string;
  };


  await upsertIntegrationCredential({
    id: cred.id,
    integration: "notion",
    integrationType: "OAUTH",
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
  }, db);
}

export const handleOauthRedirect = async (req: BunRequest, db: SqliteDb) => {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) {
    return Response.json({ error: "missing code" }, { status: 400 });
  }

  const clientId = process.env.BUN_PUBLIC_NOTION_CLIENT_ID ?? "";
  const clientSecret = process.env.NOTION_CLIENT_SECRET ?? "";

  const res = await fetch(`${NOTION_BASE_API}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/notion`,
    }),
  });

  if (!res.ok) {
    return Response.json({ error: "token exchange failed" }, { status: 502 });
  }

  const token = await res.json() as {
    access_token: string;
    refresh_token: string;
    bot_id: string;
    owner: any;
    workspace_icon: string;
    workspace_id: string;
    workspace_name: string;
  };


  await upsertIntegrationCredential({
    id: crypto.randomUUID(),
    integration: "notion",
    integrationType: "OAUTH",
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
  }, db);

  return Response.redirect(process.env.BUN_PUBLIC_BACKEND_BASE_URL!, 302);
}
