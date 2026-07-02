# Authentication

OAuth App — user authorizes via browser redirect.

Scopes: `repo`, `read:org`, `read:user`, `read:discussion`

Store `BUN_PUBLIC_GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` as integration env vars.

# OAuth Endpoints

## Authorization URL

```
https://github.com/login/oauth/authorize?client_id={client_id}&redirect_uri={redirect_uri}&scope=repo,read:org,read:discussion,read:user&response_type=code
```

## Access Token Exchange

```
POST https://github.com/login/oauth/access_token
Content-Type: application/json
Accept: application/json

{
  "client_id": "{client_id}",
  "client_secret": "{client_secret}",
  "code": "{code}",
  "redirect_uri": "{redirect_uri}"
}
```

Response:
```
{
  "access_token": "gho_...",
  "token_type": "bearer",
  "scope": "repo,read:org,read:discussion,read:user"
}
```

GitHub OAuth App tokens don't expire — no refresh endpoint needed.

# User Configuration

After OAuth, ask the user for a comma-separated list of repos:

```
owner/repo1, owner/repo2
```

Optionally, a branch name (defaults to the repo's default branch).

# Sync Data Sources

All requests use `Authorization: Bearer {token}`.

## Issues

Fetch all issues (filter out PRs by checking for absence of `pull_request`):

```
GET https://api.github.com/repos/{owner}/{repo}/issues?state=all&per_page=100&direction=desc
```

For each issue, fetch comments:

```
GET https://api.github.com/repos/{owner}/{repo}/issues/{number}/comments?per_page=100
```

**Artifact:** One markdown artifact per issue — title, body, labels, and threaded comments.

## Pull Requests

```
GET https://api.github.com/repos/{owner}/{repo}/pulls?state=all&per_page=100&direction=desc
```

For each PR, fetch per-file diff patches and review comments:

```
GET https://api.github.com/repos/{owner}/{repo}/pulls/{number}/files?per_page=100
```

Response per file:
```
{
  "filename": "src/auth.ts",
  "status": "modified",
  "additions": 5,
  "deletions": 2,
  "changes": 7,
  "patch": "@@ -10,7 +10,9 @@ ..."
}
```

Review comments:

```
GET https://api.github.com/repos/{owner}/{repo}/pulls/{number}/comments?per_page=100
```

**Artifact:** One markdown artifact per PR — description, per-file patch summary with snippet, and review comment threads.

## Repo Docs (README + docs/)

Fetch README:

```
GET https://api.github.com/repos/{owner}/{repo}/readme
Accept: application/vnd.github.raw+json
```

Discover markdown files in docs/:

```
GET https://api.github.com/repos/{owner}/{repo}/contents/docs/
```

Recurse into `docs/` and any `.md` files found at the root. Fetch raw content for each.

**Artifact:** One markdown artifact per doc file, keyed by file path.

## Discussions (GraphQL)

GitHub Discussions are only available via GraphQL:

```
POST https://api.github.com/graphql
Content-Type: application/json

{
  "query": "query($owner: String!, $repo: String!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      discussions(first: 100, after: $cursor) {
        nodes {
          number
          title
          body
          url
          createdAt
          category { name }
          comments(first: 50) {
            nodes { body createdAt author { login } }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }",
  "variables": { "owner": "...", "repo": "..." }
}
```

**Artifact:** One markdown artifact per discussion thread — title, body, category, and comments.

## Codebase (Source Files)

Fetch the full repo tree, filter for source files, then fetch content per file.

### Get file tree

```
GET https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1
```

Response contains `tree: [{ path, sha, type, mode }]`. Filter `type = "blob"`.

### Exclusion rules

Skip paths matching:
- `node_modules/`, `dist/`, `build/`, `out/`, `.git/`, `vendor/`, `coverage/`, `.next/`, `.cache/`
- Binary extensions: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.ico`, `.woff`, `.woff2`, `.eot`, `.ttf`, `.mp3`, `.mp4`, `.mov`, `.zip`, `.tar`, `.gz`, `.br`, `.webp`, `.avif`
- Files > 100 KB

### Include extensions

Source: `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.rs`, `.java`, `.rb`, `.php`, `.c`, `.cpp`, `.h`, `.hpp`, `.cs`, `.swift`, `.kt`, `.scala`, `.mjs`, `.cjs`, `.mts`, `.cts`, `.vue`, `.svelte`

Config/doc: `.json`, `.yaml`, `.yml`, `.toml`, `.md`, `.css`, `.scss`, `.less`, `.sql`

### Fetch file contents

```
GET https://api.github.com/repos/{owner}/{repo}/git/blobs/{sha}
Accept: application/vnd.github.raw
```

Returns raw file content. Use a bottleneck limiter (like `aiGatewayBottleneck`) to stay within the 5,000 req/hr rate limit.

### Artifact

One markdown artifact per source file. Wrap in a code fence with language hint:

```
# File: src/auth.ts

```typescript
// file content here
```
```

For `.md` files, render inline (no code fence). Use the file path as the artifact ID.
