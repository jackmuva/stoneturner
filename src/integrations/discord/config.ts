import type { IntegrationConfig } from "@/core/models/models";

const urlParams = new URLSearchParams({
  response_type: "code",
  client_id: process.env.BUN_PUBLIC_DISCORD_CLIENT_ID ?? "",
  scope: "identify bot",
  permissions: "66560",
  disable_guild_select: "false",
  integration_type: "0",
  redirect_uri: `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/discord`,
  prompt: "consent",
}).toString();

export const discordConfig: IntegrationConfig = {
  integration: "discord",
  icon: "/assets/discord.png",
  integrationType: "OAUTH",
  description: "Connect Discord via OAuth (NOTE: You must be a server manager to sync messages)",
  oauthAuthorizationUrl: `https://discord.com/oauth2/authorize?${urlParams}`,
};
