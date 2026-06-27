import { getIntegrationCredentialByIntegration, upsertIntegrationCredential } from "@/core/db/queries/queries";
import Bottleneck from "bottleneck";

export const discordApiBottleneck = new Bottleneck({
  maxConcurrent: 5,
  minTime: 200
});

export const DISCORD_API_ENDPOINT = "https://discord.com/api/v10";

export const refreshDiscordTokens = async () => {
  const credential = await getIntegrationCredentialByIntegration("discord");
  if (!credential?.refreshToken) {
    throw new Error("no discord refresh token available");
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
      grant_type: "refresh_token",
      refresh_token: credential.refreshToken,
    }).toString(),
  });

  if (!res.ok) {
    throw new Error("discord token refresh failed");
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
    ...credential,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? credential.refreshToken,
    tokenExpiration,
  });
}
