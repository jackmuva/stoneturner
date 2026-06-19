import type { IntegrationConfig } from "@/core/models/models";

const urlParams = new URLSearchParams({
  response_type: "code",
  client_id: process.env.BUN_PUBLIC_DISCORD_CLIENT_ID ?? "",
  scope: process.env.BUN_PUBLIC_DISCORD_SCOPE ?? "",
  redirect_uri: process.env.BUN_PUBLIC_DISCORD_REDIRECT_URI ?? "",
  prompt: "consent",
  integration_type: "1",
}).toString();

export const discordConfig: IntegrationConfig = {
  integration: "discord",
  icon: "/assets/discord.png",
  integrationType: "OAUTH",
  oauthAuthorizationUrl: `https://discord.com/oauth2/authorize?${urlParams}`,
};
