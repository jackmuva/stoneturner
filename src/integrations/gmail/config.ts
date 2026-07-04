import type { IntegrationConfig } from "@/core/models/models";

const redirectUri = encodeURIComponent(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/gmail`);
const scope = encodeURIComponent("https://www.googleapis.com/auth/gmail.readonly");

export const gmailConfig: IntegrationConfig = {
  integration: "gmail",
  icon: "/assets/gmail.svg",
  integrationType: "OAUTH",
  description: "Connect Gmail via OAuth to sync your email messages into searchable markdown artifacts. After authorizing, optionally provide a Gmail search query to filter which messages are synced (defaults to inbox).",
  oauthAuthorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.BUN_PUBLIC_GMAIL_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`,
  optionInputs: [
    { key: "query", label: "Gmail search query (optional, e.g. in:inbox, is:unread, from:alice@example.com)" },
  ],
};
