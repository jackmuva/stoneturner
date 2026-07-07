# Writing integration specs

An integration spec is the **input document** for the
`build-stoneturner-integration` skill. It tells an agent everything it needs to
know about an external API — auth, endpoints, response shapes, and how raw data
maps to markdown artifacts — without having to reverse-engineer the vendor docs
during implementation.

Specs live in `integration-specs/<name>-spec.md` at the repo root (e.g.
`integration-specs/github-spec.md`). When you start a new integration, write the
spec first, then follow the steps in `../SKILL.md`.

## What a good spec covers

A spec should give an agent enough detail to scaffold `config.ts`, design drizzle
tables, write sync/parse steps, and register the integration — without guessing.

| Section | Purpose |
|---|---|
| **Authentication** | How users connect: `API_KEY`, `BASIC_TOKEN`, or `OAUTH`. Required env vars, scopes, token exchange/refresh endpoints, and where extra fields go (`options` vs credential columns). |
| **User configuration** | Anything the user sets after auth: repo lists, crawl URLs, workspace IDs, branch names, etc. |
| **Sync data sources** | One subsection per fetch step: HTTP method + URL, headers, query/body params, pagination, polling loops, rate limits. |
| **Artifact mapping** | For each data source: how many `mdArtifact` rows, what each contains, and the stable `integrationArtifactId` key. |

You do **not** need to describe the shared parse/index pipeline, drizzle
migration commands, or registry wiring — the skill handles that. Focus on the
**external API contract** and the **artifact contract**.

## Spec template

Copy this skeleton into `integration-specs/<name>-spec.md` and fill it in:

```markdown
# Authentication

<API_KEY | BASIC_TOKEN | OAUTH — pick one>

<For API_KEY: where the user gets the key; any optionInputs (stored in `options`)>
<For BASIC_TOKEN: which of accessKey / secretKey / baseUrl are needed>
<For OAUTH: authorization URL, token exchange, refresh (if any), scopes, env vars>

# User Configuration

<Optional. Comma-separated lists, defaults, anything stored in credential `options`.>

# Sync Data Sources

All requests use `<auth header pattern>`.

## <Source name 1>

<What this fetch retrieves and when it runs (full vs incremental hint).>

```
<METHOD> <URL>
<Headers, query params, body — use curl or plain HTTP blocks>
```

Response:
```
<Example JSON or field list>
```

**Artifact:** <One sentence — e.g. "One markdown artifact per issue — title, body, labels, threaded comments. Key: `{owner}/{repo}#{number}`">

## <Source name 2>

...
```

## Section-by-section guidance

### Authentication

Map directly to `IntegrationConfig.integrationType` (see `auth.md`):

- **API_KEY** — user enters a single key. Extra non-column fields (URL lists,
  limits, workspace IDs) belong in `optionInputs` → stored in `options`.
- **BASIC_TOKEN** — user enters `accessKey`, `secretKey`, and/or `baseUrl` (only
  those three column names are allowed).
- **OAUTH** — document the full flow:
  - Authorization URL (with placeholder `{client_id}`, `{redirect_uri}`, scopes)
  - Token exchange (`POST` body, headers, response fields)
  - Refresh endpoint (if tokens expire; note if they don't, like GitHub)
  - Env vars: `BUN_PUBLIC_<NAME>_CLIENT_ID`, `<NAME>_CLIENT_SECRET`

Include real curl examples when the vendor's auth is non-obvious (form-encoded
body, Basic auth on client credentials, etc.).

### User configuration

Spell out every field the UI should collect after credentials are saved. Say
whether it is required, the format (comma-separated, JSON, integer), and any
defaults. These become `optionInputs` on the config or post-OAuth setup prompts.

### Sync data sources

One heading per logical fetch step (these usually become separate
`sync-<thing>-step.ts` files that can run in parallel).

For each source, include:

1. **Endpoint** — method, path, required headers, pagination params
   (`page`, `cursor`, `per_page`, etc.)
2. **Example request** — curl or fenced HTTP block an agent can adapt
3. **Response shape** — sample JSON or a field list; call out nested arrays and
   IDs you'll store as unique keys in drizzle
4. **Follow-up calls** — e.g. "for each issue, fetch comments at …"
5. **Operational notes** — polling interval, rate limits, exclusion rules,
   incremental cutoff (e.g. `updated_at > lastSync`)
6. **Pagination resume state** — name the cursor/next-page field; the corresponding
   sync step must accept an optional `inputs` object (e.g. `{ cursor }`) and
   persist it in `syncTask.inputs` so syncs can resume after failure (see
   `sync-pipeline.md`). Register the step in `steps.ts` for automatic retry.

### Artifact mapping

Every sync source must end with an **Artifact** line. This is the contract the
parse step implements:

- **Granularity** — one artifact per X (issue, file, page, meeting, PR, …)
- **Markdown content** — what fields/sections to render (title, body, comments,
  metadata, code fences with language hints)
- **Stable ID** — the business key used as `integrationArtifactId` so re-syncs
  upsert instead of duplicating (file path, `{owner}/{repo}#{number}`, external
  `id`, etc.)

If a source produces multiple artifact types (GitHub: issues, PRs, docs, code),
document each separately.

## What to leave out

- Implementation of `index-vector` — shared; never spec it per integration
- Drizzle schema column names — the implementer derives these from your response
  shapes
- Frontend/React details — only credential fields and `optionInputs` matter
- LLM prompt wording for parse — the parse step follows a shared pattern; your
  job is to define the markdown input

## Example specs

Three complete specs ship with this skill as references. Read them before writing
your own — they show the expected depth and format:

| Spec | Auth | Highlights |
|---|---|---|
| [`integration-spec-examples/github-spec.md`](integration-spec-examples/github-spec.md) | OAuth | Multiple parallel sync sources, GraphQL, pagination, exclusion rules, per-file artifacts |
| [`integration-spec-examples/firecrawl-spec.md`](integration-spec-examples/firecrawl-spec.md) | API_KEY + options | User-supplied URL list, async crawl + poll loop, nested response schema |
| [`integration-spec-examples/plaud-spec.md`](integration-spec-examples/plaud-spec.md) | OAuth + refresh | Token refresh, paginated list + detail fetch, nested transcript JSON in response |

The canonical copies also live at `integration-specs/` in the repo root.

## Checklist before implementation

- [ ] Auth type chosen and all OAuth/token endpoints documented with examples
- [ ] Env vars listed (`BUN_PUBLIC_*` for client IDs, secrets for server-side)
- [ ] Every fetch step has method, URL, headers, and sample response
- [ ] Pagination, polling, or rate limits called out where non-obvious
- [ ] Each sync source ends with an **Artifact** line (granularity + stable ID)
- [ ] User configuration fields (if any) specify format and defaults
- [ ] Spec file saved as `integration-specs/<name>-spec.md`

Once the spec is complete, proceed with `../SKILL.md` starting at step 1
(Scaffold the folder).
