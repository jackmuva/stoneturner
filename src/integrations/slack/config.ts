import type { IntegrationConfig } from "@/core/models/models";

const urlParams = new URLSearchParams({
  client_id: process.env.BUN_PUBLIC_SLACK_CLIENT_ID ?? "",
  user_scope: "channels:history,channels:read,users:read",
  redirect_uri: `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/slack`,
}).toString();

export const slackConfig: IntegrationConfig = {
  integration: "slack",
  icon: "/assets/slack.svg",
  integrationType: "OAUTH",
  description: "Connect Slack via OAuth to sync public channel messages",
  oauthAuthorizationUrl: `https://slack.com/oauth/v2/authorize?${urlParams}`,
};
