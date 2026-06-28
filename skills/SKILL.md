---
name: build-stoneturner-integration
description: Build a new Stoneturner integration end-to-end — sync external data, parse it into markdown artifacts, vectorize it, and expose it over the MCP server. Use when adding a new data source (a SaaS API, an OAuth app, etc.) under src/integrations/.
---

# Building a Stoneturner integration

Stoneturner is a data sync & search layer for agents. Each integration syncs an
external source, parses the raw data into markdown artifacts, vectorizes them,
and exposes them to agents over the MCP server. Every integration is a
self-contained folder under `src/integrations/<name>/` that exports two objects:
an `IntegrationConfig` (how users authenticate) and an `Integration` (the sync
pipeline + lifecycle hooks).

This skill walks through the whole process. Read the reference files for deeper
detail and copy-paste-ready patterns drawn from the existing Gong, Notion, and
Discord integrations.

- `references/anatomy.md` — the two core types, the folder layout, and the registries.
- `references/sync-pipeline.md` — how to write sync / parse / index steps, including rate limiting, retries, sync-task logging, and the markdown-artifact contract.
- `references/auth.md` — `BASIC_TOKEN`, `API_KEY`, and `OAUTH` credential patterns (including `handleRedirect` and `refreshAccessTokens`).
- `references/checklist.md` — a copy-pasteable end-to-end checklist plus the commands to run.

## The mental model

```
sync-data (parallel fetches) → parse (LLM-extracted insights) → index-vector (embed + upsert)
```

1. **sync-data** — fetch from the external API, write rows into your
   integration's own SQLite tables. Steps can run in parallel.
2. **parse** — read those rows, render markdown, call the summarization LLM to
   extract `keyPoints` / `questionsAnswered` / `entities`, and upsert one
   `mdArtifact` per logical item.
3. **index-vector** — `indexVectorDbStep(integration, incremental)` from
   `src/core/services/index-vector-db-step.ts`. **This step is shared — you do
   not write it.** It chunks each artifact's markdown, embeds content / key
   points / questions, and upserts the vector rows.

Syncs are **fire-and-forget** from the HTTP handler (no `await` — see
`src/index.ts`), so all error handling must live inside your steps and be
recorded as `syncTask` rows.

## Steps

Work through these in order. Lean on the references rather than reinventing
patterns — the existing integrations already solved rate limiting, pagination,
incremental sync, and idempotency.

### 1. Scaffold the folder

```
src/integrations/<name>/
  config.ts                 # exports IntegrationConfig
  integration.ts            # exports Integration (pipeline + hooks)
  db/
    schema.ts               # drizzle tables for the raw source data
    queries.ts              # typed insert/select/delete helpers
  models/
    models.ts               # types for the external API responses
  sync-steps/
    sync-<thing>-step.ts    # one or more fetch steps
    parse-step.ts           # raw rows → mdArtifact
```

See `references/anatomy.md`.

### 2. Define the config (`config.ts`)

Pick `integrationType`: `BASIC_TOKEN`, `API_KEY`, or `OAUTH`. For token/key
auth, declare `inputs` (allowed values: `accessKey`, `secretKey`, `baseUrl` —
these map to columns on `integrationCredential` - all other input types should be store in **input options**). For OAuth, set
`oauthAuthorizationUrl`. See `references/auth.md`.

### 3. Define raw-data schemas + queries (`db/`)

Mirror the source's shape in drizzle tables. Give each row a stable unique key
(e.g. `callId`) and use `onConflictDoUpdate` so re-syncs are idempotent. Then
register the schema path in `drizzle.config.ts`. See `references/anatomy.md`.

### 4. Write the sync steps (`sync-steps/`)

- Read credentials via `getIntegrationCredentialByIntegration("<Name>")`.
- Wrap every network/LLM call in `retry()` (`src/lib/utils.ts`).
- Throttle **all** AI Gateway calls through `aiGatewayBottleneck.schedule(...)`.
- Support an `incremental` flag (fetch only new/updated items).
- Record a `syncTask` row (SUCCESS/FAILED) at each step.
- The parse step upserts `mdArtifact` rows — that is the contract the shared
  vector step consumes.

See `references/sync-pipeline.md`.

### 5. Assemble the pipeline + `Integration` (`integration.ts`)

Compose your steps into one `syncPipeline(incremental)` function, then export an
`Integration` whose `sync` calls it with `false`, `syncUpdates` with `true`, and
`deleteSync` purges syncTasks + artifacts + embeddings + your own tables. Add
`handleRedirect` / `refreshAccessTokens` only for OAuth.

### 6. Register it

Add the config to `src/integrations/config-registry.ts` and the integration to
`src/integrations/sync-registry.ts`. Routes in `src/index.ts` dispatch by
matching the `:integration` path param against `config.integration`
(case-insensitive) — no route changes needed.

### 7. Migrate and test

```bash
bun run generate      # schema → migration files
bun run migrate       # apply
bun dev               # hot-reload server on :9000
```

Set `BUN_PUBLIC_DEV_MODE=true` to point at `test-stoneturner.db` while iterating.
Trigger a sync with `POST /api/sync/<name>` and watch `syncTask` rows / the web
UI. See `references/checklist.md`.

## Conventions to respect

- `@/*` is the alias for `src/*`.
- The shared vector step is `index-vector-db-step.ts` — reuse it, don't fork it.
- The middleware directory is misspelled `middlware/` on purpose; don't "fix" it.
- Keep the value passed to `indexVectorDbStep(...)` identical to
  `config.integration` and to the integration string you write on every
  `mdArtifact` / `syncTask` — they're matched as plain strings.
