# Slack Integration Spec

Sync messages from **public channels** in a Slack workspace. Modeled after the Discord integration (`src/integrations/discord/`) — same three-step pipeline (sync → parse → index-vector), OAuth auth, and per-channel/day markdown artifacts.

**Scope (v1):** public channels only. No private channels, DMs, group DMs, or file downloads.

---

# Authentication

Slack App with **OAuth 2.0 v2** (authorization code grant). Stoneturner uses the same OAUTH pattern as Discord/Notion:

- `integrationType: "OAUTH"`
- `oauthAuthorizationUrl` → `https://slack.com/oauth/v2/authorize?...`
- `handleRedirect` → exchange code at `oauth.v2.access`, store tokens + workspace metadata
- `refreshAccessTokens` → only needed if **token rotation** is enabled on the Slack app

### Env vars

```
BUN_PUBLIC_SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
```

Also required (shared): `BUN_PUBLIC_BACKEND_BASE_URL` for the redirect URI.

Add `BUN_PUBLIC_SLACK_CLIENT_ID` to `.env` (empty value is fine in dev) so the frontend bundle inlines it.

### Slack App setup (api.slack.com)

1. Create a Slack App → **OAuth & Permissions**.
2. Add Redirect URL: `{BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/slack` (HTTPS in production).
3. Enable **public distribution** if the app will be installed on workspaces other than the one where it was created (`invalid_team_for_non_distributed_app` otherwise).
4. Request the scopes below.
5. (Optional) Enable **token rotation** under OAuth settings for expiring tokens (12-hour lifetime). If enabled, implement `refreshAccessTokens` and persist the rotated refresh token on every refresh.

### Token strategy: user token (recommended)

Use a **user access token** (`xoxp-` or rotated `xoxe.xoxp-`) with **user scopes**. User tokens with `channels:history` can read **all public channels** in the workspace, even channels the authorizing user has not joined.

This differs from Discord, which stores OAuth credentials but reads messages with a separate `DISCORD_BOT_TOKEN` env var. Slack has no separate server-side bot token env var in this spec — the OAuth callback stores the user token in `integrationCredential.accessToken` and all Web API calls use it.

| Approach | Scopes | Pros | Cons |
|---|---|---|---|
| **User token (recommended)** | `user_scope=channels:history,channels:read,users:read` | Reads all public channels without joining each one | Acts as the installing user; token revoked if user deactivated |
| Bot token (alternative) | `scope=channels:read,channels:history,channels:join` | App identity, survives user leaving | Bot must be **member** of each channel; use `conversations.join` for public channels or `/invite @bot` |

**v1 recommendation:** user token only. Skip bot token unless a future requirement needs app-identity actions.

### Required scopes (user token)

| Scope | Purpose |
|---|---|
| `channels:read` | List public channels via `conversations.list` |
| `channels:history` | Read message history via `conversations.history` and thread replies via `conversations.replies` |
| `users:read` | Resolve `user` IDs to display names via `users.list` / `users.info` |

Do **not** request `groups:history`, `im:history`, or `mpim:history` — out of scope for v1.

---

# OAuth Endpoints

Base API URL: `https://slack.com/api`

## Authorization URL

Redirect the user to install the app and grant scopes:

```
https://slack.com/oauth/v2/authorize?client_id={client_id}&user_scope=channels:history,channels:read,users:read&redirect_uri={redirect_uri}&state={csrf_state}
```

- `user_scope` — comma-separated user scopes (no spaces).
- `redirect_uri` — must match a Redirect URL configured in the Slack app settings exactly.
- `state` — optional CSRF nonce; validate on callback (same pattern as other integrations).

Example (localhost):

```
https://slack.com/oauth/v2/authorize?client_id=3336676.569200954261&user_scope=channels:history,channels:read,users:read&redirect_uri=http%3A%2F%2Flocalhost%3A9000%2Fapi%2Foauth%2Fslack
```

## OAuth callback

Slack redirects to:

```
{BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/slack?code={temporary_code}&state={state}
```

The `code` expires in **10 minutes**. Exchange it immediately.

## Access token exchange

```
POST https://slack.com/api/oauth.v2.access
Content-Type: application/x-www-form-urlencoded
Authorization: Basic {base64(client_id:client_secret)}

code={code}&redirect_uri={redirect_uri}
```

Response (user-token-only install):

```json
{
  "ok": true,
  "app_id": "A0KRD7HC3",
  "authed_user": {
    "id": "U1234",
    "scope": "channels:history,channels:read,users:read",
    "access_token": "xoxp-1234-5678-abcdef",
    "token_type": "user"
  },
  "team": {
    "name": "Acme Corp",
    "id": "T9TK3CUKW"
  },
  "enterprise": null,
  "is_enterprise_install": false
}
```

**Store in `integrationCredential`:**

| Field | Value |
|---|---|
| `integration` | `"slack"` |
| `integrationType` | `"OAUTH"` |
| `accessToken` | `authed_user.access_token` |
| `refreshToken` | `authed_user.refresh_token` (only if token rotation enabled) |
| `tokenExpiration` | computed from `authed_user.expires_in` if present, else `null` |
| `baseUrl` | `https://slack.com/api` |

**Store workspace in `slackTeam` table** (mirrors `discordGuild` insert on OAuth callback):

| Field | Source |
|---|---|
| `id` | `team.id` |
| `name` | `team.name` |
| `enterpriseId` | `enterprise?.id` |
| `isEnterpriseInstall` | `is_enterprise_install` |

Redirect to `BUN_PUBLIC_BACKEND_BASE_URL` on success (same as Discord/Notion).

## Token refresh (only if token rotation enabled)

Slack OAuth tokens do **not** expire by default. If token rotation is enabled on the app, access tokens expire in **12 hours** (`expires_in: 43200`).

```
POST https://slack.com/api/oauth.v2.access
Content-Type: application/x-www-form-urlencoded
Authorization: Basic {base64(client_id:client_secret)}

grant_type=refresh_token&refresh_token={refresh_token}
```

Response includes a **new** `access_token` and a **new** `refresh_token`. The old refresh token is revoked — always overwrite both in the DB. Refresh proactively (~every 10 hours). Implement single-flight locking if multiple sync workers can run concurrently.

If token rotation is **disabled**, `refreshAccessTokens` can be a no-op (like GitHub).

---

# Web API conventions

All Slack Web API methods return JSON with an `ok` boolean. Check `ok === false` and handle the `error` field.

**Auth header (preferred):**

```
Authorization: Bearer {access_token}
```

**Rate limiting:** On `error: "ratelimited"`, read the `Retry-After` response header (seconds) and retry via the shared `retry()` helper.

**Bottleneck:** Create a `slackApiBottleneck` in `sync-steps/slack-utils.ts` (same settings as Discord: `maxConcurrent: 5`, `minTime: 200`). Schedule every Slack API call through it.

---

# Sync Pipeline

Mirrors Discord (`src/integrations/discord/integration.ts`):

```
syncChannels → syncUsers → syncMessages → syncThreadReplies → parseSlackMessages → indexVectorDbStep("slack", incremental, db)
```

Register as:

```ts
export const syncSlackPipeline = async (incremental: boolean, db: SqliteDb) => {
  await syncChannels(db);
  await syncUsers(db);
  await syncMessages(incremental, db);
  await syncThreadReplies(incremental, db);
  await parseSlackMessages(incremental, db);
  await indexVectorDbStep("slack", incremental, db);
};
```

Each step writes `syncTask` rows. Catch errors per channel/page — never throw to the HTTP handler.

---

## Step 1 — syncChannels

List all **public, non-archived** channels and upsert into `slackChannel`.

```
GET https://slack.com/api/conversations.list?types=public_channel&exclude_archived=true&limit=200
Authorization: Bearer {access_token}
```

Paginate with `cursor` from `response_metadata.next_cursor` until empty.

Response channel object (subset):

```json
{
  "ok": true,
  "channels": [
    {
      "id": "C12345678",
      "name": "general",
      "is_channel": true,
      "is_group": false,
      "is_im": false,
      "is_mpim": false,
      "is_private": false,
      "is_archived": false,
      "is_member": true,
      "num_members": 42,
      "topic": { "value": "Company-wide announcements", "creator": "U123", "last_set": 1449709364 },
      "purpose": { "value": "This channel is for...", "creator": "U123", "last_set": 1449709364 },
      "created": 1449252889
    }
  ],
  "response_metadata": { "next_cursor": "dGVhbTpDMDYxRkE1UEI=" }
}
```

**Filter:** only persist channels where `is_private === false`. Skip archived channels (`exclude_archived=true` handles this at the API level, but double-check `is_archived`).

**syncTask step name:** `slack-sync-channels`

**Discord equivalent:** `syncChannels` → `GET /guilds/{guildId}/channels`

---

## Step 2 — syncUsers

Cache workspace members for display-name resolution during parse.

```
GET https://slack.com/api/users.list?limit=200
Authorization: Bearer {access_token}
```

Paginate with `cursor`. Store `id`, `name`, `real_name`, `profile.display_name`, `profile.real_name`, `is_bot`, `deleted`.

**syncTask step name:** `slack-sync-users`

Run on every full sync; on incremental, refresh if last sync > 24h or skip if user cache is fresh enough.

---

## Step 3 — syncMessages

Fetch message history for each public channel. Upsert into `slackMessage`.

```
GET https://slack.com/api/conversations.history?channel={channel_id}&limit=200
Authorization: Bearer {access_token}
```

### Pagination

Two mechanisms (can combine):

1. **Cursor pagination** — pass `cursor={response_metadata.next_cursor}` until empty.
2. **Time pagination** — if `has_more: true` within a time window, set `latest` to the `ts` of the oldest message in the current page.

Messages are returned **most recent first**.

### Incremental sync

On incremental (`syncUpdates`), only fetch messages **newer** than the last stored message per channel:

```
GET .../conversations.history?channel={channel_id}&oldest={last_message_ts}&limit=200
```

`oldest` is a Unix timestamp string (Slack `ts` format, e.g. `1512085950.000216`). Query `getLastMessageByChannelId(channelId, db)` (mirrors Discord).

On full sync (`sync()` with `incremental=false`), paginate through entire history.

### Message filtering

Persist messages where `type === "message"` and the message has displayable content. **Skip** subtypes that are not conversational:

- `channel_join`, `channel_leave`, `channel_topic`, `channel_purpose`, `channel_name`, `channel_archive`, `channel_unarchive`
- `group_join`, `group_leave`
- `pinned_item`, `unpinned_item`

**Include** regular messages, `bot_message` (bot-authored content), and `file_share` (capture `text` + file metadata in JSON, do not download files).

### Message object (subset)

```json
{
  "type": "message",
  "user": "U061F7AUR",
  "text": "Has anyone tried the new API?",
  "ts": "1512085950.000216",
  "thread_ts": "1512085950.000216",
  "reply_count": 3,
  "reply_users_count": 2,
  "latest_reply": "1512104434.000490",
  "edited": { "user": "U061F7AUR", "ts": "1512085970.000216" },
  "reactions": [{ "name": "thumbsup", "count": 2, "users": ["U061F7AUR", "U222BBB222"] }],
  "attachments": [],
  "blocks": [],
  "bot_id": null,
  "subtype": null
}
```

**Primary key:** composite uniqueness on `(channelId, ts)` — Slack `ts` is unique within a channel.

**Thread handling:** Top-level messages with `reply_count > 0` have `thread_ts === ts`. Store `threadTs`, `replyCount`, `latestReply` on the parent. Thread replies are synced in Step 4.

**syncTask step name:** `slack-sync-channel-messages` (one task per channel, log `channelId` + cursor/`oldest` in `inputs`)

**Discord equivalent:** `syncMessages` → `GET /channels/{channelId}/messages?after={lastMessageId}`

---

## Step 4 — syncThreadReplies

For each parent message with `reply_count > 0`, fetch the full thread.

```
GET https://slack.com/api/conversations.replies?channel={channel_id}&ts={thread_ts}&limit=200
Authorization: Bearer {access_token}
```

- `ts` = the parent message's `thread_ts` (same as parent `ts` for thread roots).
- First message in the response is always the parent; subsequent messages are replies.
- Paginate with `cursor` if `has_more: true`.
- Incremental: only fetch threads where `latest_reply` is newer than the last stored reply for that thread.

Store replies in `slackMessage` with `threadTs` set to the parent's `ts` and `isReply: true`.

**syncTask step name:** `slack-sync-thread-replies`

**Discord equivalent:** Discord stores thread messages as separate channels; Slack keeps them under the parent channel with `thread_ts`.

---

## Step 5 — parseSlackMessages

Read raw messages from DB, render markdown, LLM-extract insights, upsert `mdArtifact`. Follow the Discord parse pattern (`parse-message-threads.ts`).

### Artifact grouping

Two artifact types (same as Discord):

1. **Channel day bundles** — top-level (non-reply) messages in a channel, grouped by calendar day (UTC or workspace timezone).
   - `integrationArtifactId`: `{channelId}-{readableDate}` (e.g. `C12345678-July 3, 2026`)
   - `artifactDate`: ISO start-of-day timestamp

2. **Thread bundles** — all messages in a thread (parent + replies).
   - `integrationArtifactId`: `{channelId}-{threadTs}` (e.g. `C12345678-1512085950.000216`)
   - `artifactDate`: parent message timestamp

### Markdown format

Channel day:

```markdown
# Messages for #general July 3, 2026
---
Alice (@alice) - 2026-07-03T14:32:10Z: Has anyone tried the new API?
---
Bob (@bob) - 2026-07-03T14:35:22Z: Yes, we shipped it yesterday.
---
```

Thread:

```markdown
# Thread in #general: Has anyone tried the new API?
---
Alice (@alice) - 2026-07-03T14:32:10Z: Has anyone tried the new API?
---
Bob (@bob) - 2026-07-03T14:35:22Z: Yes, we shipped it yesterday.
---
```

Resolve `user` IDs via cached `slackUser` rows. Fall back to raw user ID if not found.

### LLM extraction

Same prompt/schema as Discord:

```ts
output: Output.object({
  schema: z.object({
    keyPoints: z.array(z.string()),
    questionsAnswered: z.array(z.string()),
    entities: z.array(z.string()),
  }),
}),
```

Schedule through `aiGatewayBottleneck`. Skip re-summarization if markdown unchanged (`getMdArtifactByIntegrationArtifactId` idempotency check).

**Incremental:** skip days/threads whose latest message timestamp ≤ `getLastArtifactDateByIntegration("slack", db)`.

**syncTask step name:** `slack-parse-messages`

---

## Step 6 — index-vector (shared)

```ts
await indexVectorDbStep("slack", incremental, db);
```

No custom code — reuses `src/core/services/index-vector-db-step.ts`.

---

# Database Schema

Add under `src/integrations/slack/db/schema.ts`. Register in `drizzle.config.ts`.

### slackTeam

Mirrors `discordGuild` — one row per installed workspace.

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | Slack team ID (`T…`) |
| `name` | text | Workspace name |
| `domain` | text nullable | From `team.info` if fetched |
| `enterpriseId` | text nullable | Enterprise Grid org ID |
| `isEnterpriseInstall` | boolean | From OAuth response |

### slackChannel

Mirrors `discordChannel`.

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | Channel ID (`C…`) |
| `teamId` | text FK | → `slackTeam.id` |
| `name` | text | Channel name (without `#`) |
| `topic` | text nullable | From `topic.value` |
| `purpose` | text nullable | From `purpose.value` |
| `numMembers` | integer nullable | |
| `isArchived` | boolean | |
| `created` | integer | Unix timestamp |

Index: `slackChannel_teamId_idx`

### slackUser

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | User ID (`U…`) |
| `teamId` | text | |
| `name` | text | Slack username |
| `realName` | text nullable | |
| `displayName` | text nullable | From profile |
| `isBot` | boolean | |
| `deleted` | boolean | |

### slackMessage

Mirrors `discordMessage` (simplified for Slack's model).

| Column | Type | Notes |
|---|---|---|
| `ts` | text | Message timestamp ID |
| `channelId` | text FK | → `slackChannel.id` |
| `userId` | text nullable | Null for system messages |
| `text` | text | Message body (may be empty for attachment-only) |
| `threadTs` | text nullable | Parent thread ts for replies |
| `isReply` | boolean | True if this is a thread reply (not the parent) |
| `replyCount` | integer nullable | On parent messages only |
| `latestReply` | text nullable | On parent messages only |
| `subtype` | text nullable | Slack message subtype |
| `editedTs` | text nullable | From `edited.ts` |
| `reactions` | json | `[{ name, count, users }]` |
| `attachments` | json | Raw attachment metadata |
| `blocks` | json | Block Kit blocks (store raw, render `text` fallback in parse) |
| `botId` | text nullable | |

**Primary key:** composite `(channelId, ts)` via unique index `slackMessage_channelId_ts_unique_idx`.

Indexes:
- `slackMessage_channelId_idx`
- `slackMessage_threadTs_idx`

---

# Rate Limits

| Method | Tier | Limit |
|---|---|---|
| `conversations.list` | Tier 2 | ~20+ per minute |
| `conversations.history` | Tier 3 | ~50+ per minute |
| `conversations.replies` | Tier 3 | ~50+ per minute |
| `users.list` | Tier 2 | ~20+ per minute |
| `oauth.v2.access` | Special | 600 per minute |

**Important (May 2025 policy):** For new apps **commercially distributed outside the Slack Marketplace**, `conversations.history` and `conversations.replies` are limited to **1 request/minute** with `limit` max **15**. Internal/customer-built apps and Marketplace apps keep Tier 3 limits. Plan for the stricter tier if distributing broadly.

Wrap all calls in `retry()` with `Retry-After` awareness. Use `slackApiBottleneck` to avoid burst rate limits.

---

# deleteSync

Mirror Discord's purge order:

```ts
deleteSync: async (db) => {
  await deleteAllSlackData(db);           // integration tables
  await deleteSyncTasksByIntegration("slack", db);
  await deleteMdArtifactsByIntegration("slack", db);
  await deleteEmbeddingByIntegration("slack", db);
}
```

Revoking the app in Slack admin also invalidates tokens (`token_revoked`).

---

# Registration Checklist

Same as other integrations:

1. `src/integrations/slack/` — config, integration, db, models, sync-steps
2. `src/integrations/sync-registry.ts` — register `slackIntegration`
3. `src/integrations/config-registry.ts` — register `slackConfig`
4. `drizzle.config.ts` — add slack schema
5. `bun run generate && bun run migrate`
6. `.env.example` — add `BUN_PUBLIC_SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`
7. Frontend icon: `/assets/slack.png`

### config.ts sketch

```ts
const urlParams = new URLSearchParams({
  client_id: process.env.BUN_PUBLIC_SLACK_CLIENT_ID ?? "",
  user_scope: "channels:history,channels:read,users:read",
  redirect_uri: `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/slack`,
}).toString();

export const slackConfig: IntegrationConfig = {
  integration: "slack",
  icon: "/assets/slack.png",
  integrationType: "OAUTH",
  description: "Connect Slack via OAuth to sync public channel messages",
  oauthAuthorizationUrl: `https://slack.com/oauth/v2/authorize?${urlParams}`,
};
```

---

# API Quick Reference

## auth.test — validate token

```
GET https://slack.com/api/auth.test
Authorization: Bearer {access_token}
```

```json
{ "ok": true, "url": "https://acme.slack.com/", "team": "Acme Corp", "user": "alice", "team_id": "T9TK3CUKW", "user_id": "U061F7AUR" }
```

## team.info — workspace metadata

```
GET https://slack.com/api/team.info
Authorization: Bearer {access_token}
```

## chat.getPermalink — link back to source message

```
GET https://slack.com/api/chat.getPermalink?channel={channel_id}&message_ts={ts}
Authorization: Bearer {access_token}
```

Useful for entity/source linking in artifacts or MCP tool responses.

---

# Error Handling

| Slack `error` | Action |
|---|---|
| `ratelimited` | Wait `Retry-After` seconds, retry |
| `token_expired` | Call `refreshAccessTokens`, retry once |
| `token_revoked` / `account_inactive` | Mark sync failed; user must re-authorize |
| `missing_scope` | Log `needed` scopes; user must re-install with correct scopes |
| `not_in_channel` | Should not occur with user token + public channels; skip channel |
| `channel_not_found` | Channel deleted; remove from DB or mark archived |
| `invalid_auth` | Re-authorize |

---

# Out of Scope (future)

- Private channels (`groups:history`, `groups:read`)
- Direct messages and group DMs
- File content download (`files:read`)
- Real-time ingestion via Events API / Socket Mode
- Emoji/reaction-only events
- Slack Connect / shared channels across workspaces
- Enterprise Grid org-wide installs (`is_enterprise_install`)
