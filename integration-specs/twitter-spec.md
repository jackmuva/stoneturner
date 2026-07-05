# Authentication

OAuth 2.0 App (Confidential Client) with **Authorization Code + PKCE**.

X/Twitter requires PKCE for user-context OAuth 2.0. Stoneturner uses `/api/oauth/twitter` for both
OAuth steps: a visit without a `code` query param generates PKCE parameters, stores them in cookies,
and redirects to X; the callback with `code` exchanges the authorization code using the stored
`code_verifier`.

Store `BUN_PUBLIC_TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET` as integration env vars.

## Scopes

| Scope | Purpose |
|---|---|
| `tweet.read` | Read post content |
| `users.read` | Read user profile (`GET /2/users/me`) |
| `like.read` | Read posts the user has liked |
| `offline.access` | Refresh tokens for long-lived access |

## OAuth Endpoints

### Step 1 — Authorize (PKCE)

Stoneturner server generates `code_verifier` + S256 `code_challenge`, then redirects:

```
GET https://twitter.com/i/oauth2/authorize
  ?response_type=code
  &client_id={client_id}
  &redirect_uri={redirect_uri}
  &scope=tweet.read%20users.read%20like.read%20offline.access
  &state={state}
  &code_challenge={code_challenge}
  &code_challenge_method=S256
```

Notes:
- `state` must be ≤ 500 characters.
- Callback URL must exactly match the redirect URI registered in the X developer portal.

### Step 2 — Token Exchange

```
POST https://api.twitter.com/2/oauth2/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic {base64(client_id:client_secret)}

code={code}
&grant_type=authorization_code
&client_id={client_id}
&redirect_uri={redirect_uri}
&code_verifier={code_verifier}
```

Response:
```json
{
  "token_type": "bearer",
  "expires_in": 7200,
  "access_token": "...",
  "scope": "tweet.read users.read like.read offline.access",
  "refresh_token": "..."
}
```

### Step 3 — Refresh Token

```
POST https://api.twitter.com/2/oauth2/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic {base64(client_id:client_secret)}

grant_type=refresh_token
&refresh_token={refresh_token}
&client_id={client_id}
```

# User Context

OAuth stores only the bearer token and refresh token. At sync time, resolve the authenticated
user's ID via:

```
GET /2/users/me?user.fields=id
```

Use `data.id` as `{id}` in the liked tweets request below.

All data requests use `Authorization: Bearer {access_token}`.

# Sync Data Source

Base URL: `https://api.twitter.com/2`

Query parameters:
- `max_results=100` (single request — no pagination)
- `tweet.fields=created_at,author_id,conversation_id,in_reply_to_user_id,lang,public_metrics,entities,referenced_tweets`
- `expansions=author_id,referenced_tweets.id`
- `user.fields=username,name`

## Liked Posts

```
GET /2/users/{id}/liked_tweets?max_results=100
```

Returns the authenticated user's 100 most recently liked posts. One API call per sync — no
pagination, no historical backfill beyond the latest 100 likes.

**Artifact:** One markdown artifact per liked post — author, text, metrics, conversation context, URL.

# Rate Limits

X API v2 rate limits vary by endpoint and access tier. All Twitter API calls are throttled through
a shared Bottleneck limiter (`maxConcurrent: 5`, `minTime: 200`) and wrapped in `retry()`.

On 401, attempt token refresh via `refreshAccessTokens` and retry once.

# Incremental Sync

Each sync re-fetches the latest 100 liked posts and upserts by `tweetId`. Parse and vector index
steps run incrementally on artifacts that changed.

# Developer Setup

1. Create a project and app at [developer.x.com](https://developer.x.com).
2. Enable OAuth 2.0 with **Authorization Code Flow with PKCE**.
3. Set callback URL to `{BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/twitter`.
4. Copy Client ID and Client Secret into `.env`.
