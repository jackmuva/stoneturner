import type { IntegrationConfig } from "@/core/models/models";

const urlParams = new URLSearchParams({
  response_type: "code",
  client_id: process.env.BUN_PUBLIC_DISCORD_CLIENT_ID ?? "",
  scope: "identify guilds.members.read messages.read bot guilds applications.commands",
  permissions: "66560",
  disable_guild_select: "false",
  integration_type: "0",
  redirecty_uri: `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/discord}`,
  prompt: "consent",
}).toString();

export const discordConfig: IntegrationConfig = {
  integration: "discord",
  icon: "/assets/discord.png",
  integrationType: "OAUTH",
  oauthAuthorizationUrl: `https://discord.com/oauth2/authorize?${urlParams}`,
  installUrl: process.env.BUN_PUBLIC_DISCORD_INSTALL_URL,
};
