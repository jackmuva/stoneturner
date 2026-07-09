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

- `references/integration-specs.md` — how to write an integration spec (the input document for this skill). Includes a template, section guide, and example specs in `references/integration-spec-examples/`.
- `references/anatomy.md` — the two core types, the folder layout, and the registries (config, sync, step).
- `references/sync-pipeline.md` — how to write sync / parse / index steps, including rate limiting, retries, sync-task logging, step-registry registration, the explore agent, and the markdown-artifact contract.
- `references/auth.md` — `BASIC_TOKEN`, `API_KEY`, and `OAUTH` credential patterns (including `handleRedirect` and `refreshAccessTokens`).
- `references/checklist.md` — a copy-pasteable end-to-end checklist plus the commands to run.

## The mental model

```
sync-data (parallel fetches) → parse (LLM-extracted insights) → index-vector (embed + upsert) → agent-explore (lay-of-the-land context)
```

1. **sync-data** — fetch from the external API, write rows into your
   integration's own SQLite tables. Steps can run in parallel.
2. **parse** — read those rows, render markdown, call the summarization LLM to
   extract `keyPoints` / `questionsAnswered` / `entities`, and upsert one
   `mdArtifact` per logical item.
3. **index-vector** — `indexVectorDbStep(incremental, db, { integration })` from
   `src/core/services/index-vector-db-step.ts`. **This step is shared — you do
   not write it.** It chunks each artifact's markdown, embeds content / key
   points / questions, and upserts the vector rows.
4. **agent-explore** — `agentExploreContextStep(incremental, db, { integration })`
   from `src/core/services/agent-explore-context-step.ts`. **This step is shared
   — you do not write it.** An LLM agent explores the integration's data (via
   tools in `explore-tools.ts`) and writes a lay-of-the-land overview to
   `sourceContext`. MCP clients load it with `get_data_source_context`.

Syncs are **fire-and-forget** from the HTTP handler (no `await` — see
`src/index.ts`), so all error handling must live inside your steps and be
recorded as `syncTask` rows.

The shared drizzle handle `db: SqliteDb` (`src/core/models/db-models.ts`) is
created once in `src/core/db/db.ts`, passed in at the route layer, and threaded
as an explicit parameter through every `Integration` method, pipeline function,
sync/parse step, and query helper. Accept `db` as a parameter — do **not**
`import { db } from "@/core/db/db"` inside integration code.

## Steps

Work through these in order. Lean on the references rather than reinventing
patterns — the existing integrations already solved rate limiting, pagination,
incremental sync, and idempotency.

### 0. Write the integration spec

Before touching code, **research the integration's authentication and APIs** from
the vendor's official docs. Most integrations use **OAuth** (authorization URL,
token exchange, and sometimes refresh). Others use an **API key** the user
generates in the vendor dashboard, or an **access key + secret key** pair
(sometimes with a base URL). Identify which model applies and document every
auth endpoint, scope, and env var before moving on.

Then capture the external API contract in `integration-specs/<name>-spec.md`.
The spec documents auth, sync endpoints, response shapes, and how each data
source maps to markdown artifacts — it is the blueprint the rest of this skill
implements.

See `references/integration-specs.md` for the template and checklist. Use the
example specs in `references/integration-spec-examples/` (GitHub, Firecrawl,
Plaud) as references for depth and format.

### 1. Scaffold the folder

```
src/integrations/<name>/
  config.ts                 # exports IntegrationConfig
  integration.ts            # exports Integration (pipeline + hooks)
  steps.ts            # exports IntegrationSteps map for retry lookup
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

All step functions share the `IntegrationStepFn` signature:

```ts
(incremental: boolean, db: SqliteDb, inputs?: any, syncTaskId?: string) => Promise<void> | void
```

- Take `db: SqliteDb` as the second parameter and pass it to every query call.
- Read credentials via `getIntegrationCredentialByIntegration("<Name>", db)`.
- Wrap every network/LLM call in `retry()` (`src/lib/utils.ts`).
- Throttle **all** AI Gateway calls through `aiGatewayBottleneck.schedule(...)`.
- Support an `incremental` flag (fetch only new/updated items).
- Accept an optional `inputs` arg with resume state (cursor, offset, etc.) and an
  optional `syncTaskId` so retries update the same `syncTask` row. Persist
  resume state in each page's `syncTask.inputs` (see
  `src/integrations/notion/sync-steps/sync-notion-pages.ts`). When `inputs` is
  provided, paginated steps process **one batch** and stop (retry mode).
- Record a `syncTask` row (SUCCESS/FAILED) at each step — pass `id: syncTaskId`
  when retrying.
- The parse step upserts `mdArtifact` rows — that is the contract the shared
  vector step consumes.

See `references/sync-pipeline.md`.

### 5. Assemble the pipeline + `Integration` (`integration.ts`)

Compose your steps into one `syncPipeline(incremental, db)` function, then export
an `Integration` whose `sync(db)` calls it with `false`, `syncUpdates(db)` with
`true`, and `deleteSync(db)` purges syncTasks + artifacts + embeddings +
sourceContext + your own tables. Add `handleRedirect(req, db)` /
`refreshAccessTokens(db)` only for OAuth. End the pipeline with
`agentExploreContextStep` (see `references/sync-pipeline.md`).

### 6. Register it

Add the config to `src/integrations/config-registry.ts` and the integration to
`src/integrations/integration-registry.ts`. Export an `IntegrationSteps` map from
`steps.ts` and register it in `src/integrations/step-registry.ts` so
failed steps can be retried. Include `"agent-explore": agentExploreContextStep`
in your steps map. Routes in `src/index.ts` dispatch by
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
- Thread `db: SqliteDb` through every method/step/query; never `import { db }`.
- Every step function must match `IntegrationStepFn` and be registered in
  `step-registry.ts` for automatic retry of FAILED tasks (including shared steps
  like `index-vector` and `agent-explore`).
- Keep the integration string passed to `indexVectorDbStep(..., { integration })`
  identical to `config.integration` and to the integration string you write on
  every `mdArtifact` / `syncTask` — they're matched as plain strings.
