import type { IntegrationConfig } from "@/core/models/models";

const LINEAR_SCOPES = "read";

export const linearConfig: IntegrationConfig = {
  integration: "linear",
  icon: "/assets/linear.svg",
  integrationType: "OAUTH",
  description: "Connect Linear via OAuth to sync issues and projects into searchable markdown artifacts.",
  oauthAuthorizationUrl: `https://linear.app/oauth/authorize?client_id=${process.env.BUN_PUBLIC_LINEAR_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/linear`)}&response_type=code&scope=${encodeURIComponent(LINEAR_SCOPES)}`,
};
