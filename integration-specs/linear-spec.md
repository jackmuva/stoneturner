# Linear

Project management integration — syncs issues and projects from a Linear workspace into markdown artifacts for semantic search.

# Authentication

OAuth 2.0 — user authorizes via browser redirect.

Scopes: `read` (default read access for issues, projects, teams, comments).

Store `BUN_PUBLIC_LINEAR_CLIENT_ID` and `LINEAR_CLIENT_SECRET` as integration env vars.

# OAuth Endpoints

## Authorization URL

```
GET https://linear.app/oauth/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope=read
```

## Access Token Exchange

```
POST https://api.linear.app/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
client_id={client_id}
client_secret={client_secret}
code={code}
redirect_uri={redirect_uri}
```

Response:

```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 86399,
  "scope": "read",
  "refresh_token": "..."
}
```

Access tokens expire after 24 hours. Refresh tokens rotate on each refresh.

## Refresh Token

```
POST https://api.linear.app/oauth/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)

grant_type=refresh_token
refresh_token={refresh_token}
```

# Sync Data Sources

All requests use `Authorization: Bearer {access_token}` against the GraphQL endpoint `https://api.linear.app/graphql`.

Pagination uses Relay-style cursor pagination (`first` / `after` / `pageInfo.hasNextPage` / `pageInfo.endCursor`).

## Issues

Fetches all workspace issues ordered by `updatedAt`. For incremental sync, filters with `updatedAt > {watermark}`.

```graphql
query Issues($first: Int!, $after: String, $filter: IssueFilter) {
  issues(first: $first, after: $after, orderBy: updatedAt, filter: $filter) {
    nodes {
      id
      identifier
      title
      description
      priority
      estimate
      url
      createdAt
      updatedAt
      state { name type }
      team { id key name }
      assignee { name displayName }
      labels { nodes { name } }
      project { id name }
      comments(first: 100) {
        nodes {
          body
          createdAt
          user { name displayName }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

**Storage:** `linearIssue` table — one row per issue with denormalized fields and comments JSON.

**Artifact:** One markdown artifact per issue — identifier, title, description, state, team, labels, assignee, project, and threaded comments. Key: `{teamKey}-{identifier}` (e.g. `ENG-123`).

## Projects

Fetches all workspace projects ordered by `updatedAt`. For incremental sync, filters with `updatedAt > {watermark}`.

```graphql
query Projects($first: Int!, $after: String, $filter: ProjectFilter) {
  projects(first: $first, after: $after, orderBy: updatedAt, filter: $filter) {
    nodes {
      id
      name
      description
      state
      progress
      url
      createdAt
      updatedAt
      startDate
      targetDate
      teams { nodes { name key } }
      lead { name displayName }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

**Storage:** `linearProject` table — one row per project.

**Artifact:** One markdown artifact per project — name, description, status, dates, teams, and lead. Key: `project:{id}`.

# Pipeline

```
sync-issues + sync-projects (parallel) → parse → index-vector → agent-explore
```

# Incremental sync notes

- Watermark is the latest `updatedAt` stored in the integration tables.
- `GTE`-style filters may return the boundary record twice — upserts are idempotent on `issueId` / `projectId`.
- Linear rate limits apply; requests are throttled client-side.
