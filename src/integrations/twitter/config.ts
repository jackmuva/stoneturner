import type { IntegrationConfig } from "@/core/models/models";

const backendBase = process.env.BUN_PUBLIC_BACKEND_BASE_URL ?? "http://localhost:9000";
const clientId = process.env.BUN_PUBLIC_TWITTER_CLIENT_ID ?? "";

export const twitterConfig: IntegrationConfig = {
  integration: "twitter",
  icon: "/assets/twitter.svg",
  integrationType: "OAUTH",
  description: "Connect X (Twitter) via OAuth to sync your 100 most recent likes into searchable markdown.",
  oauthAuthorizationUrl: `${backendBase}/api/oauth/twitter/authorize?client_id=${clientId}`,
};
