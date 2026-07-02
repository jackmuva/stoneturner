import type { IntegrationConfig } from "@/core/models/models";

export const plaudConfig: IntegrationConfig = {
  integration: "Plaud",
  icon: "/assets/plaud.png",
  integrationType: "OAUTH",
  description: "Connect Plaud via OAuth to sync your meeting recordings and transcripts.",
  oauthAuthorizationUrl: `https://app.plaud.ai/platform/oauth?client_id=${process.env.BUN_PUBLIC_PLAUD_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/plaud`)}&response_type=code`,
};
