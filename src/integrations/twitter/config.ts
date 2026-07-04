import type { IntegrationConfig } from "@/core/models/models";

const backendBase = process.env.BUN_PUBLIC_BACKEND_BASE_URL ?? "http://localhost:9000";
const clientId = process.env.BUN_PUBLIC_TWITTER_CLIENT_ID ?? "";

export const twitterConfig: IntegrationConfig = {
  integration: "twitter",
  icon: "/assets/twitter.svg",
  integrationType: "OAUTH",
  description: "Connect X (Twitter) via OAuth to sync your posts, mentions, and bookmarks into searchable markdown. Requires an [X developer app](https://developer.x.com) with OAuth 2.0 PKCE enabled.",
  oauthAuthorizationUrl: `${backendBase}/api/oauth/twitter/authorize?client_id=${clientId}`,
};
