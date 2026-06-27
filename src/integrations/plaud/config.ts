import type { IntegrationConfig } from "@/core/models/models";

export const plaudConfig: IntegrationConfig = {
  integration: "Plaud",
  icon: "/assets/plaud.png",
  integrationType: "OAUTH",
  description: "Connect Plaud via OAuth to sync your meeting recordings and transcripts.",
  oauthAuthorizationUrl: `https://app.plaud.ai/platform/oauth?client_id=${process.env.BUN_PUBLIC_PLAUD_CLIENT_ID}&redirect_uri=http%3A%2F%2Flocalhost%3A9000%2Fapi%2Foauth%2Fplaud&response_type=code`,
};
