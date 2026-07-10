import type { IntegrationConfig } from "@/core/models/models";

const HUBSPOT_SCOPES = [
  "oauth",
  "crm.objects.contacts.read",
  "crm.objects.companies.read",
  "crm.objects.deals.read",
  "conversations.read",
  "crm.lists.read"
].join(" ");

export const hubspotConfig: IntegrationConfig = {
  integration: "hubspot",
  icon: "/assets/hubspot.png",
  integrationType: "OAUTH",
  description: "Connect HubSpot via OAuth to sync contacts, companies, and deals into queryable tables.",
  oauthAuthorizationUrl: `https://app.hubspot.com/oauth/authorize?client_id=${process.env.BUN_PUBLIC_HUBSPOT_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/hubspot`)}&scope=${encodeURIComponent(HUBSPOT_SCOPES)}`,
};
