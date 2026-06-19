import type { Integration } from "@/core/models/models";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration, upsertIntegrationCredential } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { discordConfig } from "./config";
import type { BunRequest } from "bun";

const DISCORD_API_ENDPOINT = "https://discord.com/api/v10";

export const syncDiscordPipeline = async (incremental: boolean = false) => {
  await indexVectorDbStep("discord", incremental);
}

const handleOauthRedirect = async (req: BunRequest) => {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) {
    return Response.json({ error: "missing code" }, { status: 400 });
  }

  const clientId = process.env.BUN_PUBLIC_DISCORD_CLIENT_ID ?? "";
  const clientSecret = process.env.DISCORD_CLIENT_SECRET ?? "";

  const res = await fetch(`${DISCORD_API_ENDPOINT}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/discord`,
    }).toString(),
  });

  if (!res.ok) {
    return Response.json({ error: "token exchange failed" }, { status: 502 });
  }

  const token = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope: string;
  };

  const tokenExpiration = new Date(Date.now() + token.expires_in * 1000).toISOString();

  await upsertIntegrationCredential({
    id: crypto.randomUUID(),
    integration: "discord",
    integrationType: "OAUTH",
    apiKey: null,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    accessKey: null,
    secretKey: null,
    baseUrl: DISCORD_API_ENDPOINT,
    tokenExpiration,
  });

  return Response.redirect(process.env.BUN_PUBLIC_BACKEND_BASE_URL!, 302);
}

export const discordIntegration: Integration = {
  config: discordConfig,
  sync: async () => await syncDiscordPipeline(false),
  syncUpdates: async () => await syncDiscordPipeline(true),
  deleteSync: async () => {
    await deleteSyncTasksByIntegration("discord");
    await deleteMdArtifactsByIntegration("discord");
    await deleteEmbeddingByIntegration("discord");
  },
  handleRedirect: handleOauthRedirect,
}


