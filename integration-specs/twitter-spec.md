# Authentication

OAuth 2.0 App (Confidential Client) with **Authorization Code + PKCE**.

X/Twitter requires PKCE for user-context OAuth 2.0. Stoneturner initiates auth via a server-side
`/api/oauth/twitter/authorize` endpoint that generates PKCE parameters, stores them in cookies,
and redirects to X. The callback at `/api/oauth/twitter` exchanges the code using the stored
`code_verifier`.

Store `BUN_PUBLIC_TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET` as integration env vars.

## Scopes

| Scope | Purpose |
|---|---|
| `tweet.read` | Read tweets the user can view (own timeline, mentions, bookmarks) |
| `users.read` | Read user profile (`GET /2/users/me`) |
| `bookmark.read` | Read bookmarked tweets |
| `offline.access` | Refresh tokens for long-lived access |

## OAuth Endpoints

### Step 1 — Authorize (PKCE)

Stoneturner server generates `code_verifier` + S256 `code_challenge`, then redirects:

```
GET https://twitter.com/i/oauth2/authorize
  ?response_type=code
  &client_id={client_id}
  &redirect_uri={redirect_uri}
  &scope=tweet.read%20users.read%20bookmark.read%20offline.access
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
  "scope": "tweet.read users.read bookmark.read offline.access",
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

After OAuth, call `GET /2/users/me?user.fields=username,name,created_at,description,public_metrics`
to capture the authenticated user's ID and username. Store `userId` and `username` in credential
`options` for subsequent sync requests.

All data requests use `Authorization: Bearer {access_token}`.

# Sync Data Sources

Base URL: `https://api.twitter.com/2`

Common query parameters for tweet endpoints:
- `max_results=100` (max per page)
- `tweet.fields=created_at,author_id,conversation_id,in_reply_to_user_id,lang,public_metrics,entities,referenced_tweets`
- `expansions=author_id,referenced_tweets.id`
- `user.fields=username,name`
- `pagination_token` — pass `meta.next_token` from prior response
- `since_id` — for incremental sync, pass the newest tweet ID already stored for that source

## 1. User Tweets (timeline)

```
GET /2/users/{user_id}/tweets
```

Returns posts authored by the authenticated user, reverse-chronological.

**Artifact:** One markdown artifact per tweet — text, metrics, conversation context, URL.

## 2. Mentions

```
GET /2/users/{user_id}/mentions
```

Returns tweets mentioning the authenticated user.

**Artifact:** One markdown artifact per mention — prefixed as a mention, includes author and metrics.

## 3. Bookmarks

```
GET /2/users/{user_id}/bookmarks
```

Requires `bookmark.read` scope.

**Artifact:** One markdown artifact per bookmarked tweet.

# Rate Limits

X API v2 rate limits vary by endpoint and access tier. All Twitter API calls are throttled through
a shared Bottleneck limiter (`maxConcurrent: 5`, `minTime: 200`) and wrapped in `retry()`.

On 401, attempt token refresh via `refreshAccessTokens` and retry once.

# Incremental Sync

For each source (tweets, mentions, bookmarks), track the highest `tweetId` (snowflake ID) already
stored. On incremental sync, pass `since_id={latest_tweet_id}` so only newer posts are fetched.
Stop pagination early when a page returns no new IDs.

# Developer Setup

1. Create a project and app at [developer.x.com](https://developer.x.com).
2. Enable OAuth 2.0 with **Authorization Code Flow with PKCE**.
3. Set callback URL to `{BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/twitter`.
4. Copy Client ID and Client Secret into `.env`.
