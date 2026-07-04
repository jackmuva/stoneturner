import type { IntegrationConfig } from "@/core/models/models";

const redirectUri = encodeURIComponent(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/google-calendar`);
const scopes = encodeURIComponent(
  "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.calendarlist.readonly",
);

export const googleCalendarConfig: IntegrationConfig = {
  integration: "google-calendar",
  icon: "/assets/google-calendar.svg",
  integrationType: "OAUTH",
  description: "Connect Google Calendar via OAuth to sync your calendars and events into searchable markdown.",
  oauthAuthorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.BUN_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}&access_type=offline&prompt=consent&include_granted_scopes=true`,
};
