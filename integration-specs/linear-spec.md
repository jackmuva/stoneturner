# Authentication

OAuth 2.0 App — user authorizes via browser redirect. Linear uses short-lived access tokens (24 hours) with refresh tokens. All OAuth apps use refresh tokens as of April 2026.

**Scopes:** `read` (required minimum for sync). Do not request `write`, `admin`, or mutation scopes unless Stoneturner later adds write-back features.

**Actor:** Use default `actor=user` so synced content reflects the authorizing user's access. Do not use `actor=app` unless implementing a service-account-style integration.

Store env vars:
- `BUN_PUBLIC_LINEAR_CLIENT_ID`
- `LINEAR_CLIENT_SECRET`

Register the OAuth app at [linear.app/settings/api](https://linear.app/settings/api) → OAuth applications. Set callback URL to `{BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/linear`.

Enable **Refresh Tokens** on the OAuth app (default for apps created after Oct 1, 2025).

# OAuth Endpoints

## Authorization URL

```
GET https://linear.app/oauth/authorize?response_type=code&client_id={client_id}&redirect_uri={redirect_uri}&scope=read&state={secure_random}
```

Optional params:
- `state` — CSRF protection; validate on callback
- `prompt=consent` — force consent screen (useful for multi-workspace installs)

Linear also supports PKCE (`code_challenge`, `code_challenge_method=S256`). Not required for a confidential server-side app, but supported if needed.

## Access Token Exchange

```
POST https://api.linear.app/oauth/token
Content-Type: application/x-www-form-urlencoded

code={code}&redirect_uri={redirect_uri}&client_id={client_id}&client_secret={client_secret}&grant_type=authorization_code
```

Response:
```json
{
  "access_token": "00a21d8b0c4e2375114e49c067dfb81eb0d2076f48354714cd5df984d87b67cc",
  "token_type": "Bearer",
  "expires_in": 86399,
  "scope": "read",
  "refresh_token": "sz0c8ffy95zj2ff6bh1hiausauw3dbfsu4gly1z4p49b5odqv8l7owunb654vg1f"
}
```

Store `accessToken`, `refreshToken`, and compute `tokenExpiration` from `expires_in` on `integrationCredential`.

## Refresh Access Token

Call before sync if `tokenExpiration` is near/past. Linear rotates refresh tokens on each refresh; always persist the new `refresh_token`.

```
POST https://api.linear.app/oauth/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic {base64(client_id:client_secret)}

refresh_token={refresh_token}&grant_type=refresh_token
```

Alternative: pass `client_id` and `client_secret` as form fields instead of Basic auth.

Response returns a new `access_token` and a new `refresh_token`. Linear allows replaying a valid refresh request for up to 30 minutes if the first response was lost.

## Revoke Token

Call on `deleteSync` or credential removal:

```
POST https://api.linear.app/oauth/revoke
Content-Type: application/x-www-form-urlencoded

token={access_token_or_refresh_token}&token_type_hint=access_token
```

# User Configuration

After OAuth, optionally ask the user for a comma-separated list of team keys to sync (Linear team short codes, e.g. `ENG, PLAT, OPS`). If empty, sync all teams the user can access.

Store team keys in `integrationCredential.options.teamKeys`.

Optionally store `includeArchived: true|false` (default `false`) in options.

# GraphQL API

All sync requests use a single endpoint:

```
POST https://api.linear.app/graphql
Content-Type: application/json
Authorization: Bearer {access_token}
```

Request body:
```json
{
  "query": "...",
  "variables": { ... }
}
```

Issue IDs accept either UUID or shorthand identifier (e.g. `ENG-123`).

# Pagination

Linear uses Relay-style cursor pagination. Default page size is 50; max `first` is 250.

Pattern:
```graphql
query Issues($after: String, $first: Int, $filter: IssueFilter) {
  issues(first: $first, after: $after, filter: $filter, orderBy: updatedAt) {
    nodes { id identifier title updatedAt }
    pageInfo { hasNextPage endCursor }
  }
}
```

Loop while `pageInfo.hasNextPage`, passing `pageInfo.endCursor` as `$after`.

For incremental sync, filter with `updatedAt: { gt: "<ISO timestamp>" }` and order by `updatedAt`.

Pass explicit `first` values to control query complexity (see Rate Limiting).

# Rate Limiting

Linear enforces both request-count and complexity budgets per hour.

| Auth | Request limit | Complexity limit |
| --- | --- | --- |
| OAuth app | 5,000 / user / hour | 2,000,000 points / hour |
| API key | 2,500 / user / hour | 3,000,000 points / hour |

Response headers to monitor:
- `X-RateLimit-Requests-Remaining`, `X-RateLimit-Requests-Reset`
- `X-Complexity`, `X-RateLimit-Complexity-Remaining`, `X-RateLimit-Complexity-Reset`

On limit exceeded, GraphQL returns HTTP 400 with `errors[].extensions.code = "RATELIMITED"`. Back off using `retry()` and respect reset headers.

**Guidelines for Stoneturner:**
- Use a dedicated bottleneck limiter (similar to `notionApiBottleneck`: `maxConcurrent: 5`, `minTime: 200`).
- Keep `first` at 50–100 for list queries; fetch nested comments in a second pass only when needed.
- Avoid polling; use `updatedAt` filters for incremental sync.
- Prefer team-scoped queries over workspace-wide queries when team keys are configured.

# Sync Data Sources

All requests use `Authorization: Bearer {token}` against the GraphQL endpoint.

## Teams (bootstrap)

Resolve configured team keys to IDs before syncing issues/projects:

```graphql
query Teams {
  teams {
    nodes {
      id
      key
      name
    }
  }
}
```

Filter client-side to configured `teamKeys`, or omit filter to sync all teams.

## Issues

Fetch issues per team (or workspace-wide with team filter). Include metadata needed for markdown artifacts; fetch comments in the same query or a follow-up query per issue batch.

```graphql
query TeamIssues($teamId: String!, $after: String, $first: Int, $filter: IssueFilter) {
  team(id: $teamId) {
    id
    key
    name
    issues(first: $first, after: $after, filter: $filter, orderBy: updatedAt) {
      nodes {
        id
        identifier
        title
        description
        url
        priority
        estimate
        createdAt
        updatedAt
        completedAt
        archivedAt
        dueDate
        assignee { id name email }
        creator { id name }
        state { id name type }
        project { id name }
        cycle { id name number }
        labels { nodes { id name } }
        comments(first: 100) {
          nodes {
            id
            body
            createdAt
            updatedAt
            user { id name }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}
```

Paginate issue comments separately if `comments.pageInfo.hasNextPage`:

```graphql
query IssueComments($issueId: String!, $after: String) {
  issue(id: $issueId) {
    comments(first: 100, after: $after) {
      nodes {
        id
        body
        createdAt
        user { name }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}
```

**Incremental filter:**
```graphql
filter: { updatedAt: { gt: "2026-01-15T00:00:00.000Z" } }
```

**Artifact:** One markdown artifact per issue — identifier, title, description (markdown), state, priority, assignee, labels, project/cycle, due date, and threaded comments. Artifact ID: `{teamKey}/{identifier}` (e.g. `ENG/ENG-123`).

## Projects

```graphql
query Projects($after: String, $first: Int, $filter: ProjectFilter) {
  projects(first: $first, after: $after, filter: $filter, orderBy: updatedAt) {
    nodes {
      id
      name
      description
      url
      state
      progress
      startDate
      targetDate
      createdAt
      updatedAt
      archivedAt
      lead { id name }
      teams { nodes { id key name } }
      projectUpdates(first: 50) {
        nodes {
          id
          body
          health
          createdAt
          user { name }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

Filter to configured teams via `filter: { accessibleTeams: { key: { in: ["ENG", "PLAT"] } } }` when team keys are set.

**Artifact:** One markdown artifact per project — name, description, status/state, dates, lead, linked teams, and project update posts (status reports). Artifact ID: `project/{projectId}`.

## Documents

```graphql
query Documents($after: String, $first: Int, $filter: DocumentFilter) {
  documents(first: $first, after: $after, filter: $filter, orderBy: updatedAt, includeArchived: false) {
    nodes {
      id
      title
      slugId
      url
      content
      createdAt
      updatedAt
      archivedAt
      creator { name }
      updatedBy { name }
      project { id name }
      issue { id identifier title }
      comments(first: 50) {
        nodes {
          id
          body
          createdAt
          user { name }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

**Artifact:** One markdown artifact per document — title, body (`content` is markdown), linked project/issue, and comments. Artifact ID: `doc/{documentId}`.

## Initiatives (optional v2)

Lower priority than issues/projects/documents. Sync if time permits:

```graphql
query Initiatives($after: String, $first: Int) {
  initiatives(first: $first, after: $after, orderBy: updatedAt) {
    nodes {
      id
      name
      description
      url
      status
      targetDate
      owner { name }
      projects { nodes { id name } }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

**Artifact:** One markdown artifact per initiative. Artifact ID: `initiative/{initiativeId}`.

# Sync Pipeline

Mirror GitHub's parallel fetch → parse → index pattern:

```
sync-issues + sync-projects + sync-documents (parallel)
  → parse-issues + parse-projects + parse-documents (parallel)
  → index-vector (shared)
```

### Full sync
- Paginate all issues, projects, and documents for configured teams.
- Upsert raw rows with stable keys (`issueId`, `projectId`, `documentId`) via `onConflictDoUpdate`.

### Incremental sync (`syncUpdates`)
- Read latest `updatedAt` per entity type from integration tables.
- Re-fetch only records with `updatedAt > lastSync`.
- Also re-fetch issues whose comments may have changed (comment updates bump parent issue `updatedAt` in Linear).

# Raw DB Tables (proposed)

```
linearIssue     — issueId (unique), teamKey, identifier, title, description, state, labels (json), comments (json), url, metadata json, createdAt, updatedAt
linearProject   — projectId (unique), name, description, state, updates (json), url, createdAt, updatedAt
linearDocument  — documentId (unique), title, content, url, projectId, issueId, comments (json), createdAt, updatedAt
```

# Integration Config (proposed)

```ts
integration: "linear"
integrationType: "OAUTH"
oauthAuthorizationUrl: `https://linear.app/oauth/authorize?response_type=code&client_id=${BUN_PUBLIC_LINEAR_CLIENT_ID}&redirect_uri=${encodeURIComponent(BUN_PUBLIC_BACKEND_BASE_URL + "/api/oauth/linear")}&scope=read&state=...`
optionInputs: [
  { key: "teamKeys", label: "Team keys (comma-separated, e.g. ENG, PLAT). Leave empty for all teams." },
  { key: "includeArchived", label: "Include archived items (true/false, default false)" },
]
```

Hooks:
- `handleRedirect` — exchange code, store tokens + expiration
- `refreshAccessTokens` — refresh before sync if expired

# Webhooks (future enhancement)

Linear supports webhooks for Issue, Comment, Project, Document, etc. OAuth apps can auto-register webhooks per organization on authorize. For v1, polling with `updatedAt` filters is sufficient; webhooks would enable near-real-time incremental sync without scheduled `syncUpdates` calls.

Webhook verification: HMAC-SHA256 of raw body using signing secret, header `Linear-Signature`. Also validate `webhookTimestamp` within 60 seconds.

# References

- OAuth: https://linear.app/developers/oauth-2-0-authentication
- GraphQL: https://linear.app/developers/graphql
- Pagination: https://linear.app/developers/pagination
- Filtering: https://linear.app/developers/filtering
- Rate limiting: https://linear.app/developers/rate-limiting
- Webhooks: https://linear.app/developers/webhooks
- API schema explorer: https://studio.apollographql.com/public/Linear-API/variant/current/home
- OAuth app settings: https://linear.app/settings/api
