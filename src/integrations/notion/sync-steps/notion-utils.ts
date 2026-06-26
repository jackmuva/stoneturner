import { getIntegrationCredentialByIntegration, upsertIntegrationCredential, upsertSyncTask } from "@/core/db/queries/queries";
import type { IntegrationCredential } from "@/core/db/schema/schema";

export const NOTION_BASE_API = "https://api.notion.com/v1";
export const NOTION_VERSION = "2026-03-11";

export const getNotionCredentials = async () => {
  return await getIntegrationCredentialByIntegration("notion");
}

export const handleNotionRefresh = async () => {
  const cred: IntegrationCredential | undefined = await getIntegrationCredentialByIntegration("notion");
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
      integration: "notion",
      status: "FAILED",
      inputs: { cred },
      step: "notion-token-revalidation",
    })
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
  });
}
