# Authentication

OAuth 2.0 Web Server flow — user authorizes via browser redirect to Google.

**Scope:** `https://www.googleapis.com/auth/gmail.readonly` (read email messages and settings)

Store `BUN_PUBLIC_GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` as integration env vars.

Google OAuth requires `access_type=offline` and `prompt=consent` on the authorization URL so the token exchange returns a refresh token.

# OAuth Endpoints

## Authorization URL

```
https://accounts.google.com/o/oauth2/v2/auth?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope=https://www.googleapis.com/auth/gmail.readonly&access_type=offline&prompt=consent
```

`redirect_uri` must exactly match an authorized redirect URI in the Google Cloud Console (e.g. `{BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/gmail`).

## Access Token Exchange

```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

client_id={client_id}&client_secret={client_secret}&code={code}&redirect_uri={redirect_uri}&grant_type=authorization_code
```

Response:
```json
{
  "access_token": "ya29...",
  "expires_in": 3599,
  "refresh_token": "1//...",
  "scope": "https://www.googleapis.com/auth/gmail.readonly",
  "token_type": "Bearer"
}
```

`refresh_token` is only returned on the first consent (or when `prompt=consent` is used).

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
  "scope": "https://www.googleapis.com/auth/gmail.readonly",
  "token_type": "Bearer"
}
```

## Token Revocation (optional)

```
POST https://oauth2.googleapis.com/revoke
Content-Type: application/x-www-form-urlencoded

token={access_token_or_refresh_token}
```

# User Configuration

After OAuth, optionally provide a Gmail search query to filter which messages are synced (stored in credential `options.query`). Examples:

- `in:inbox` — inbox only (default if no query set)
- `is:unread`
- `from:someone@example.com`
- `label:work`

# Sync Data Sources

All requests use `Authorization: Bearer {access_token}`.

Base URL: `https://gmail.googleapis.com/gmail/v1`

## User Profile (optional, for display)

```
GET /users/me/profile
```

Response:
```json
{
  "emailAddress": "user@gmail.com",
  "messagesTotal": 1234,
  "threadsTotal": 567,
  "historyId": "123456"
}
```

## List Messages

Lists message IDs in the user's mailbox. Returns only `id` and `threadId` per message — use `messages.get` for full content.

```
GET /users/me/messages?maxResults=100&pageToken={pageToken}&q={query}
```

Query parameters:

| Parameter | Description |
|---|---|
| `maxResults` | Max messages per page (default 100, max 500) |
| `pageToken` | Token for the next page |
| `q` | Gmail search query (same syntax as the Gmail search box). For incremental sync use `after:YYYY/MM/DD` |
| `labelIds` | Only return messages with all specified label IDs |
| `includeSpamTrash` | Include SPAM and TRASH (default false) |

Response:
```json
{
  "messages": [{ "id": "18c5f2...", "threadId": "18c5f2..." }],
  "nextPageToken": "...",
  "resultSizeEstimate": 42
}
```

## Get Message

```
GET /users/me/messages/{id}?format=full
```

`format` values: `minimal`, `full`, `raw`, `metadata`.

Response (relevant fields):
```json
{
  "id": "18c5f2...",
  "threadId": "18c5f2...",
  "labelIds": ["INBOX", "UNREAD"],
  "snippet": "Preview text...",
  "historyId": "1234567",
  "internalDate": "1705315555000",
  "payload": {
    "mimeType": "multipart/alternative",
    "headers": [
      { "name": "Subject", "value": "Meeting notes" },
      { "name": "From", "value": "alice@example.com" },
      { "name": "To", "value": "bob@example.com" },
      { "name": "Date", "value": "Mon, 15 Jan 2024 10:00:00 +0000" }
    ],
    "parts": [
      {
        "mimeType": "text/plain",
        "body": { "data": "SGVsbG8gd29ybGQ=" }
      }
    ]
  }
}
```

Message body text is extracted recursively from `payload.parts` (prefer `text/plain`; fall back to stripped `text/html`). Part `body.data` is base64url-encoded.

## Incremental Sync

On incremental sync, append `after:YYYY/MM/DD` to the list query based on the latest stored message `internalDate`. Gmail's `internalDate` (epoch ms) is the canonical ordering timestamp.

# Artifacts

**One markdown artifact per email message**, keyed by Gmail message `id`.

Markdown structure:

```markdown
# {Subject}

**From:** {From}
**To:** {To}
**Date:** {Date header or internalDate}
**Labels:** {labelIds joined}

{body text}
```

Parse step runs the standard Stoneturner LLM extraction (key points, questions answered, entities).
