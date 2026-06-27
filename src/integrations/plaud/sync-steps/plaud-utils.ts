import { getIntegrationCredentialByIntegration, upsertIntegrationCredential, upsertSyncTask } from "@/core/db/queries/queries";
import type { IntegrationCredential } from "@/core/db/schema/schema";
import type { PlaudTokenResponse } from "../models/models";
import Bottleneck from "bottleneck";
import type { BunRequest } from "bun";

export const plaudApiBottleneck = new Bottleneck({
  maxConcurrent: 5,
  minTime: 200,
});

export const PLAUD_BASE_API = "https://platform.plaud.ai/developer/api";

export const getPlaudCredentials = async (): Promise<IntegrationCredential | undefined> => {
  return await getIntegrationCredentialByIntegration("Plaud");
}

export const handlePlaudRefresh = async (): Promise<void> => {
  const cred: IntegrationCredential | undefined = await getPlaudCredentials();
  if (!cred?.refreshToken) return;

  const res = await fetch(`${PLAUD_BASE_API}/oauth/third-party/access-token/refresh`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ refresh_token: cred.refreshToken }),
  });

  if (!res.ok) {
    await upsertSyncTask({
      integration: "Plaud",
      status: "FAILED",
      inputs: { error: await res.text() },
      step: "plaud-token-revalidation",
    });
    return;
  }

  const token = await res.json() as PlaudTokenResponse;

  await upsertIntegrationCredential({
    id: cred.id,
    integration: "Plaud",
    integrationType: "OAUTH",
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
  });
}

export const handleOauthRedirect = async (req: BunRequest): Promise<Response> => {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) {
    return Response.json({ error: "missing code" }, { status: 400 });
  }

  const clientId = process.env.BUN_PUBLIC_PLAUD_CLIENT_ID ?? "";
  const clientSecret = process.env.PLAUD_CLIENT_SECRET ?? "";
  const redirectUri = `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/plaud`;

  const res = await fetch(`${PLAUD_BASE_API}/oauth/third-party/access-token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ code, redirect_uri: redirectUri }),
  });

  if (!res.ok) {
    return Response.json({ error: "token exchange failed" }, { status: 502 });
  }

  const token = await res.json() as PlaudTokenResponse;

  await upsertIntegrationCredential({
    id: crypto.randomUUID(),
    integration: "Plaud",
    integrationType: "OAUTH",
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
  });

  return Response.redirect(process.env.BUN_PUBLIC_BACKEND_BASE_URL!, 302);
}
