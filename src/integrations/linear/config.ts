import type { IntegrationConfig } from "@/core/models/models";

const redirectUri = encodeURIComponent(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/linear`);

export const linearConfig: IntegrationConfig = {
  integration: "linear",
  icon: "/assets/linear.svg",
  integrationType: "OAUTH",
  description: "Connect Linear via OAuth to sync issues, projects, and documents into searchable markdown. After authorizing, optionally limit sync to specific team keys.",
  oauthAuthorizationUrl: `https://linear.app/oauth/authorize?response_type=code&client_id=${process.env.BUN_PUBLIC_LINEAR_CLIENT_ID}&redirect_uri=${redirectUri}&scope=read`,
  optionInputs: [
    { key: "teamKeys", label: "Team keys (comma-separated, e.g. ENG, PLAT). Leave empty for all teams.", optional: true },
    { key: "includeArchived", label: "Include archived items (true/false, default false)", optional: true },
  ],
};
