# Authentication

OAuth 2.0 — user authorizes via browser redirect to Google.

Create OAuth 2.0 credentials (Web application type) in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Enable the **Google Calendar API** for the project. Add an authorized redirect URI:

```
{BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/google-calendar
```

Store `BUN_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID` and `GOOGLE_CALENDAR_CLIENT_SECRET` as integration env vars.

## Scopes

Read-only access to calendars and events:

- `https://www.googleapis.com/auth/calendar.readonly` — see and download calendars and events
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly` — see the list of calendars the user is subscribed to

# OAuth Endpoints

## Authorization URL

```
GET https://accounts.google.com/o/oauth2/v2/auth
```

Query parameters:

| Parameter | Value |
|---|---|
| `client_id` | OAuth client ID |
| `redirect_uri` | `{BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/google-calendar` |
| `response_type` | `code` |
| `scope` | `https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.calendarlist.readonly` |
| `access_type` | `offline` |
| `prompt` | `consent` |
| `include_granted_scopes` | `true` |

Example:

```
https://accounts.google.com/o/oauth2/v2/auth?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.readonly%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.calendarlist.readonly&access_type=offline&prompt=consent&include_granted_scopes=true
```

## Access Token Exchange

```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

client_id={client_id}&client_secret={client_secret}&code={code}&grant_type=authorization_code&redirect_uri={redirect_uri}
```

Response:

```json
{
  "access_token": "ya29...",
  "expires_in": 3599,
  "refresh_token": "1//...",
  "scope": "https://www.googleapis.com/auth/calendar.readonly ...",
  "token_type": "Bearer"
}
```

Access tokens expire after ~1 hour. Store `refresh_token` and compute `tokenExpiration` from `expires_in`.

## Refresh Token

```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

client_id={client_id}&client_secret={client_secret}&refresh_token={refresh_token}&grant_type=refresh_token
```

Response:

```json
{
  "access_token": "ya29...",
  "expires_in": 3599,
  "scope": "...",
  "token_type": "Bearer"
}
```

Google may not return a new `refresh_token` on refresh — keep the existing one.

# Sync Data Sources

All requests use `Authorization: Bearer {access_token}`.

## Calendar List

Fetch every calendar the user can access:

```
GET https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250&pageToken={pageToken}
```

Response:

```json
{
  "items": [
    {
      "id": "primary",
      "summary": "Work Calendar",
      "description": "My work events",
      "timeZone": "America/Los_Angeles",
      "accessRole": "owner",
      "backgroundColor": "#9fe1e7",
      "foregroundColor": "#000000"
    }
  ],
  "nextPageToken": "..."
}
```

**Stored as:** one row per calendar in `googleCalendar`.

## Events

For each calendar, list events (expanded recurring instances):

```
GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events?singleEvents=true&orderBy=startTime&maxResults=250&pageToken={pageToken}&timeMin={timeMin}&updatedMin={updatedMin}
```

| Parameter | Full sync | Incremental sync |
|---|---|---|
| `timeMin` | ISO 8601 timestamp, 2 years ago | omitted |
| `updatedMin` | omitted | ISO 8601 timestamp of most recently updated stored event |
| `singleEvents` | `true` | `true` |
| `orderBy` | `startTime` | `startTime` |
| `showDeleted` | `false` | `false` |

Response:

```json
{
  "items": [
    {
      "id": "abc123",
      "status": "confirmed",
      "htmlLink": "https://www.google.com/calendar/event?eid=...",
      "created": "2024-01-10T12:00:00.000Z",
      "updated": "2024-01-15T08:30:00.000Z",
      "summary": "Team Standup",
      "description": "Daily sync with the engineering team.",
      "location": "Conference Room A",
      "start": { "dateTime": "2024-01-15T09:00:00-08:00", "timeZone": "America/Los_Angeles" },
      "end": { "dateTime": "2024-01-15T09:30:00-08:00", "timeZone": "America/Los_Angeles" },
      "organizer": { "email": "alice@example.com", "displayName": "Alice", "self": true },
      "attendees": [
        { "email": "bob@example.com", "displayName": "Bob", "responseStatus": "accepted" }
      ],
      "hangoutLink": "https://meet.google.com/abc-defg-hij",
      "conferenceData": {
        "entryPoints": [{ "entryPointType": "video", "uri": "https://meet.google.com/abc-defg-hij" }]
      }
    }
  ],
  "nextPageToken": "..."
}
```

Skip events with `status: "cancelled"`.

**Artifact:** One markdown artifact per event — title, time, location, description, attendees, and meeting links. Stable artifact ID: `{calendarId}:{eventId}`.
