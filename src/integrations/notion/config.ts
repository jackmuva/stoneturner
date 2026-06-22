import type { IntegrationConfig } from "@/core/models/models";

export const notionConfig: IntegrationConfig = {
  integration: "notion",
  icon: "/assets/notion.png",
  integrationType: "OAUTH",
  description: "Connect Notion via OAuth",
  oauthAuthorizationUrl: `https://api.notion.com/v1/oauth/authorize?client_id=${process.env.BUN_PUBLIC_NOTION_CLIENT_ID}&response_type=code&owner=user&redirect_uri=http%3A%2F%2Flocalhost%3A9000%2Fapi%2Foauth%2Fnotion`
};
