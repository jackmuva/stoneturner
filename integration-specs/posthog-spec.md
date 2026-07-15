# PostHog Integration Spec

## Goal

Sync PostHog product analytics into Stoneturner as searchable markdown artifacts for agents (MCP). Prefer **OAuth via Client ID Metadata Document (CIMD)** so users can connect without pasting a personal API key. Support **personal API key (PAT)** as a simpler alternate path (and for self-hosted / scripts).

PostHog docs: [API overview](https://posthog.com/docs/api), [OAuth / CIMD](https://posthog.com/docs/api/oauth), [Personal API keys](https://posthog.com/docs/api/personal-api-keys).

---

## Why PostHog OAuth is non-traditional (vs current Stoneturner OAuth)

Stoneturner today assumes **pre-registered confidential clients**:

| Assumption (Notion/GitHub/Slack/…) | PostHog CIMD reality |
|---|---|
| Opaque `client_id` string from a provider dashboard | `client_id` **is a URL you host** (e.g. `https://<stoneturner-host>/oauth/posthog-client.json`) |
| Server-side `CLIENT_SECRET` for token exchange | CIMD clients are **public** — `token_endpoint_auth_method: "none"`, **no client secret** |
| Static `oauthAuthorizationUrl` baked into config at bundle time | Authorize URL must be built **per request** with PKCE `code_challenge` + `state` |
| Optional / missing PKCE on most integrations | PKCE **S256 required** (`code_challenge_methods_supported: ["S256"]`) |
| Token exchange often `application/json` + Basic auth | Token endpoint expects form body + `code_verifier` (no secret) |
| Single cloud host implied | Region router: prefer `https://oauth.posthog.com`; API host is US / EU / self-hosted |
| Secrets in `.env` (`BUN_PUBLIC_*_CLIENT_ID` + `*_CLIENT_SECRET`) | Env holds **CIMD public URL** (or derives it from `BUN_PUBLIC_BACKEND_BASE_URL`); no secret pair |

Closest existing analogue: **Twitter** (`src/integrations/twitter/`) — server-started OAuth, PKCE cookies, dual-mode `handleRedirect` (no `code` → begin; with `code` → exchange). Twitter still uses a pre-registered client id + secret; PostHog drops the secret and replaces the id with a hosted metadata document.

Well-known metadata (live):

- Auth server: `https://oauth.posthog.com/.well-known/oauth-authorization-server`
- Authorize: `https://oauth.posthog.com/oauth/authorize/`
- Token: `https://oauth.posthog.com/oauth/token/`
- Grants: `authorization_code`, `refresh_token`
- Token auth methods: `none`, `client_secret_post`
- CIMD flag: `client_id_metadata_document_supported: true`
- Access tokens: `pha_…` (short-lived); refresh: `phr_…`

---

## Auth strategy (recommended phases)

### Phase A — Personal API key (no core interface changes)

Ship connectability immediately via the working non-OAuth path:

- `integrationType: "BASIC_TOKEN"`
- `inputs`: `accessKey` (Personal API Key), `baseUrl` (e.g. `https://us.posthog.com` / `https://eu.posthog.com` / self-host)
- Optional `optionInputs`: `projectId` (PostHog project/environment id)

Use `Authorization: Bearer ${accessKey}` against private API host. Mirrors Firecrawl/Gong. **No CIMD, no PKCE, no interface work.** Good for single-tenant / self-hosted.

> Do **not** use `integrationType: "API_KEY"` today — the Connect dialog only persists `BASIC_TOKEN`, and `inputs[].input` has no `"apiKey"` member. Fixing that is separate cleanup.

### Phase B — OAuth CIMD (product path; requires interface / infra changes)

For multi-user “Connect with PostHog” without sharing PATs. Requires the changes below.

---

## Interface & infra changes for CIMD OAuth

### 1. `IntegrationConfig` — make server-started OAuth first-class

Current type (`src/core/models/models.ts`):

```ts
oauthAuthorizationUrl?: string,  // assumed to be the IdP authorize URL with client_id query param
```

Frontend gate (`integration-dialog.tsx`): Connect disabled unless

```ts
new URL(intConfig.oauthAuthorizationUrl!).searchParams.get("client_id")
```

**Gaps for PostHog:**

- Authorize URL cannot be static (PKCE).
- `client_id` is a long URL; stuffing it into a static config string is brittle.
- CIMD needs a discoverable document URL independent of the authorize redirect.

**Proposed config shape (additive, backward-compatible):**

```ts
export type IntegrationConfig = {
  // ...existing fields...
  oauthAuthorizationUrl?: string,

  /** When set, Connect hits this URL first; server mint PKCE/state and 302s to the IdP. */
  oauthStartPath?: string, // e.g. "/api/oauth/posthog"

  /** Public Client ID Metadata Document URL (PostHog CIMD). May equal BUN_PUBLIC_BACKEND_BASE_URL + path. */
  oauthClientIdUrl?: string,

  /** Hint for UI / docs; not used as the IdP authorize URL. */
  oauthMetadata?: {
    authorizationServer?: string, // default https://oauth.posthog.com
    scopes: string[],
    tokenEndpointAuthMethod?: "none" | "client_secret_post",
  },
};
```

**Frontend Connect click for OAUTH becomes:**

1. Persist `optionInputs` (unchanged).
2. Navigate to `oauthStartPath ?? oauthAuthorizationUrl` (not directly to PostHog).
3. Enable button if `oauthStartPath` **or** (`oauthAuthorizationUrl` has `client_id`) — so Twitter’s current hack and static Notion URLs both keep working.

Alternatively, keep zero type changes and copy Twitter’s pattern only for PostHog:

```ts
oauthAuthorizationUrl: `${backendBase}/api/oauth/posthog?client_id=${encodeURIComponent(cimdUrl)}`
```

That unblocks Connect with **no dialog change**, but leaves CIMD/PKCE as per-integration tribal knowledge. Prefer the explicit fields if we expect more CIMD/PKCE providers.

### 2. New route: host the CIMD document

PostHog fetches the `client_id` URL during authorize. Stoneturner must serve something like:

`GET ${BUN_PUBLIC_BACKEND_BASE_URL}/.well-known/posthog-oauth-client.json`  
(or `/oauth/posthog-client.json`)

```json
{
  "client_id": "https://<public-host>/.well-known/posthog-oauth-client.json",
  "client_name": "Stoneturner",
  "logo_uri": "https://<public-host>/assets/stoneturner.png",
  "redirect_uris": ["https://<public-host>/api/oauth/posthog"],
  "token_endpoint_auth_method": "none",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"]
}
```

Constraints from PostHog:

- `client_id` in the document must equal the document’s URL.
- `redirect_uris` must match the callback **exactly** (https required except loopback).
- Document is cached via `Cache-Control: max-age` — keep TTL modest while iterating redirect URIs.
- Localhost works for loopback redirects; production needs a stable public HTTPS origin (`BUN_PUBLIC_BACKEND_BASE_URL`).

Wire in `src/index.ts` (static JSON response; not under CORS-only SPA paths if possible). CIMD must be reachable by **PostHog’s servers**, not just the browser — local-only `localhost` works for the redirect, but PostHog must be able to fetch the metadata URL. For local cloud agents that implies either:

- tunnel / deployed preview URL as `BUN_PUBLIC_BACKEND_BASE_URL`, or
- PAT Phase A for local DIY.

### 3. `handleRedirect` — dual-mode + PKCE (extend Twitter pattern)

Reuse / generalize Twitter’s flow in `twitter-utils.ts`:

```
GET /api/oauth/posthog
  no ?code  → mint verifier/challenge/state, Set-Cookie, 302 → oauth.posthog.com/oauth/authorize/
  ?code=…   → validate state + verifier cookie, POST token endpoint, upsert credential, 302 home
```

Authorize query params:

```
response_type=code
client_id=<CIMD URL>
redirect_uri=<BACKEND>/api/oauth/posthog
scope=<space-separated scopes>
state=<random>
code_challenge=<S256(challenge)>
code_challenge_method=S256
```

Token exchange (`application/x-www-form-urlencoded`):

```
grant_type=authorization_code
code=…
redirect_uri=…
client_id=<CIMD URL>
code_verifier=<cookie>
# NO client_secret
```

Store on `integrationCredential`:

- `integrationType: "OAUTH"`
- `accessToken` (`pha_…`)
- `refreshToken` (`phr_…`)
- `tokenExpiration`
- `baseUrl` or `options.apiHost` — resolved API host for the user’s region (from token/userinfo / `posthog_base_url` in metadata / user option)
- `options.projectId` (optional post-connect config)

**Suggested shared helper** (new file, e.g. `src/core/services/oauth-pkce.ts`):

- `generatePkce()`, `setOauthCookies()`, `readOauthCookies()`, `clearOauthCookies()`
- Used by Twitter + PostHog → stop duplicating cookie/crypto glue.

### 4. Refresh must actually run

`Integration.refreshAccessTokens` exists but is **never invoked** by `index.ts` / cron. Notion/Twitter refresh inline on API failure. PostHog access tokens are short-lived (`pha_`), so refresh is mandatory.

Required:

1. Implement `refreshPosthogTokens` → `POST …/oauth/token/` with `grant_type=refresh_token`, `refresh_token`, `client_id=<CIMD URL>` (auth method `none`).
2. Call it from a shared `posthogFetch` on 401 (mirror Twitter/Notion), **and/or** start invoking `refreshAccessTokens` from a cron / before sync stages.

No schema change needed for refresh itself.

### 5. Env / secrets model

| Traditional OAuth | PostHog CIMD |
|---|---|
| `BUN_PUBLIC_POSTHOG_CLIENT_ID` | Derived: `${BUN_PUBLIC_BACKEND_BASE_URL}/.well-known/posthog-oauth-client.json` (or explicit `BUN_PUBLIC_POSTHOG_CLIENT_ID_URL`) |
| `POSTHOG_CLIENT_SECRET` | **Omit** |
| — | Optional verification later via PostHog (email `team-growth@posthog.com`) — not required to go live |

Update `.env.example` + AGENTS.md frontend-var list only if a `BUN_PUBLIC_*` is introduced. Prefer deriving the CIMD URL from `BUN_PUBLIC_BACKEND_BASE_URL` to avoid another missing-env footgun.

### 6. Optional credential / UI cleanups (nice-to-have, not PostHog blockers)

| Change | Why |
|---|---|
| Implement `API_KEY` save path + `inputs: "apiKey"` | Align docs (`skills/references/auth.md`) with UI; PAT could use this cleanly |
| Persist region/project after OAuth in Configure dialog | Multi-project orgs need an active project id for most private routes |
| Redirect OAuth success to `/knowledge` not site root | UX; shared across all OAuth integrations |
| Framework-level token refresh cron | Hardens Slack/Discord/PostHog instead of per-step 401 handlers |

---

## Suggested scopes (OAuth)

Request least privilege for read-only sync. Start with:

```
openid profile email
project:read
organization:read
event_definition:read
property_definition:read
insight:read
dashboard:read
feature_flag:read
experiment:read
notebook:read
annotation:read
cohort:read
error_tracking:read
survey:read
query:read
person:read
session_recording_playlist:read
```

Expand only when a sync step needs write access (none planned for v1).

Exact names must match `scopes_supported` from the well-known document (listed above are present there as of fetch).

---

## Sync data sources (v1 scope)

All private REST against the user’s API host (`https://us.posthog.com` / `https://eu.posthog.com` / self-host). Auth: `Authorization: Bearer <accessToken|pat>`.

Prefer high-signal, low-volume catalog data over raw event firehose. Raw `/api/event` dumps are huge, rate-limited, and poor as markdown — use definitions + saved analytical objects instead. For ad-hoc numbers, optional `query:read` on saved insights only.

### Pipeline shape

```ts
export const posthogPipeline: SyncStepPipeline = [
  [
    { "posthog-sync-project-context": syncProjectContextStep },
    { "posthog-sync-definitions": syncDefinitionsStep },
    { "posthog-sync-insights": syncInsightsStep },
    { "posthog-sync-dashboards": syncDashboardsStep },
    { "posthog-sync-feature-flags": syncFeatureFlagsStep },
    { "posthog-sync-experiments": syncExperimentsStep },
    { "posthog-sync-notebooks": syncNotebooksStep },
    { "posthog-sync-annotations": syncAnnotationsStep },
    { "posthog-sync-error-tracking": syncErrorTrackingStep },
  ],
  [{ parse: parsePosthogStep }], // or parallel per-entity parsers
  [{ "index-vector": bindIndexVector("posthog") }],
  [{ "agent-explore": bindAgentExplore("posthog") }],
];
```

Trim v1 to a smaller parallel stage if rate limits bite: **project context + definitions + insights + feature flags + notebooks**.

### Per-source notes

| Source | Endpoint sketch | Artifact |
|---|---|---|
| Project / org context | `/api/users/@me/`, `/api/projects/:id/` | One overview md (org, project, timezone) |
| Event definitions | `/api/projects/:id/event_definitions/` | Catalog md or chunked by letter/volume |
| Property definitions | `/api/projects/:id/property_definitions/` | Catalog md |
| Insights | `/api/projects/:id/insights/` | One md per insight (query JSON summarized + description) |
| Dashboards | `/api/projects/:id/dashboards/` | One md per dashboard + linked insight ids |
| Feature flags | `/api/projects/:id/feature_flags/` | One md per flag (key, filters, rollout) |
| Experiments | `/api/projects/:id/experiments/` | One md per experiment |
| Notebooks | `/api/projects/:id/notebooks/` | One md per notebook (content → markdown) |
| Annotations | `/api/projects/:id/annotations/` | Batched timeline md |
| Error tracking | error tracking issue list APIs | One md per open/recent issue |
| Surveys (stretch) | `/api/projects/:id/surveys/` | One md per survey |
| Persons / raw events | — | **Out of v1** (volume + PII) |

Pagination: follow `next` cursors; respect analytics limits (`240/min`, `1200/hour`) with a Bottleneck (e.g. 4 concurrent / 300ms).

Incremental: use `updated_at` / list filters where available; otherwise re-pull catalogs and upsert by PostHog id.

### DB tables (sketch)

`src/integrations/posthog/db/schema.ts` — one row per synced entity (`posthogInsight`, `posthogFeatureFlag`, …) with foreign keys to `mdArtifacts`. Register in `drizzle.config.ts`.

### Delete

`deleteSync` purges posthog tables, syncTasks, artifacts, embeddings, and `deleteSourceContextByIntegration("posthog")`. Credential delete remains out of scope (shared gap).

---

## Registration checklist (when implementing)

1. `src/integrations/posthog/` — `config.ts`, `integration.ts`, `pipeline.ts`, `db/`, `models/`, `sync-steps/`
2. `config-registry.ts` + `integration-registry.ts`
3. Schema in `drizzle.config.ts` → `bun run generate && bun run migrate`
4. CIMD route + OAuth start/callback
5. Asset `public/assets/posthog.png` (or equivalent)
6. Spec kept here as source of truth; skill scaffold: `skills/SKILL.md`

---

## Risks & open questions

1. **CIMD fetchability in local/dev** — PostHog’s servers must GET the metadata URL. Local-only hosts need a tunnel or use PAT Phase A.
2. **Region after OAuth** — confirm whether token/userinfo returns the cloud region / base URL; may still need a UI `baseUrl`/`region` option.
3. **Multi-project** — single `integrationCredential` row per integration name; store `projectId` in `options`, require Configure before sync (like GitHub repos).
4. **Self-hosted** — OAuth via `oauth.posthog.com` is cloud-oriented; self-hosted likely PAT + custom `baseUrl` only.
5. **PII** — avoid syncing persons/session recordings content into artifacts by default.
6. **Framework OAuth debt** — PostHog is a forcing function to extract PKCE helpers and fix unused `refreshAccessTokens`; decide whether that lands in the PostHog PR or a prior plumbing PR.

---

## Recommended implementation order

1. **Interface plumbing PR** (small): `oauthStartPath` / Connect-button enablement; optional shared `oauth-pkce.ts`; CIMD static route helper.
2. **PostHog Phase A (PAT)** — full sync pipeline with `BASIC_TOKEN`, proves data model + parsers without OAuth.
3. **PostHog Phase B (CIMD OAuth)** — swap/add OAuth connect; keep PAT as fallback `inputs` or separate configure mode if we add dual-auth later.

If shipping one PR only: Phase B OAuth + minimal sync (definitions + insights + flags), with CIMD + PKCE copied from Twitter and explicitly documented.
