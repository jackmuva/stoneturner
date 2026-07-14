# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Stoneturner is a data sync & search layer for agents: it syncs external integrations, parses data into markdown artifacts, vectorizes them, and exposes them to agents over an MCP server. A React web UI monitors syncs, views artifacts, and configures credentials.

## Commands

- `bun dev` — run server with hot reload (`bun --hot src/index.ts`), port 9000
- `bun run build` — bundle frontend to `dist/`
- `bun start` — production server (`NODE_ENV=production`)
- `bun run lint` — typecheck (`bun tsc --noEmit`); the only "lint" — there is no ESLint
- `bun run generate` — `drizzle-kit generate` (schema → migration files in `migrations/`)
- `bun run migrate` — `drizzle-kit migrate` (apply pending migrations)
- No test files exist yet. Set `BUN_PUBLIC_DEV_MODE=true` to point the app at `test-stoneturner.db` instead of `stoneturner.db` (see `src/core/db/db.ts`).
- `scripts/` holds one-off bulk importers/utilities (`import-gong-calls.ts`, `import-gong-transcripts.ts`, `import-md-artifacts.ts`, `import-sync-tasks.ts`, `csv-stream.ts`) run directly with `bun scripts/<file>.ts`.

## Architecture

- `src/index.ts` — single `Bun.serve()` with all routes + HMR in dev, port 9000.
- `@/*` alias → `src/*`.
- `src/core/` — shared plumbing; `src/integrations/<name>/` — one folder per integration (gong, discord, notion, plaud, firecrawl, github).
- Bun-first: `Bun.serve()`, `Bun.file`, `bunx`. No express/vite/webpack. Exception: database is Turso/libSQL via Drizzle (`@tursodatabase/database`), not `bun:sqlite`.

### Adding an integration

Create `src/integrations/<name>/` with `config.ts`, `integration.ts`, `pipeline.ts`, `db/`, `models/`, `sync-steps/`. Export an `IntegrationConfig` and an `Integration` (`src/core/models/models.ts`). The `Integration` interface:

- `syncPipeline` — a `SyncStepPipeline` (`Array<Array<StepMapping>>`) that defines the sync stages; each inner array runs in parallel, outer array runs sequentially.
- `deleteSync()` — purge syncTasks + artifacts + embeddings + integration tables.
- optional `handleRedirect(req)` — OAuth callback, `refreshAccessTokens()`.

Then register in `src/integrations/integration-registry.ts` (sync dispatch), `src/integrations/config-registry.ts` (frontend UI), and add the integration's `db/schema.ts` to the `schema` array in `drizzle.config.ts` so migrations pick it up. Routes in `src/index.ts` dispatch by matching the `:integration` path param against `config.integration` (case-insensitive): `POST /api/sync/:integration` → `runSyncPipeline(syncPipeline, false, db)`, `DELETE` → `deleteSync()`, `POST /api/sync/updates/:integration` → `runSyncPipeline(syncPipeline, true, db)`, `GET /api/oauth/:integration` → `handleRedirect()`.

There is a `build-stoneturner-integration` skill (`skills/`) that scaffolds a new integration end-to-end; `integration-specs/` holds per-integration spec docs (e.g. `firecrawl-spec.md`, `github-spec.md`, `plaud-spec.md`) used as input when building one.

## Sync pipeline

Pipelines are declared as `SyncStepPipeline` — an **array of arrays of step mappings**:

```ts
type StepMapping = { [stepName: string]: IntegrationStepFn };
type SyncStepPipeline = Array<Array<StepMapping>>;
```

Each inner array is one **stage**; steps within a stage run in parallel (`Promise.allSettled`). Stages run sequentially. Define the pipeline in `src/integrations/<name>/pipeline.ts` and attach it to the `Integration` as `syncPipeline`. `runSyncPipeline` (`src/core/services/pipeline-runner.ts`) executes it.

Typical shape:

```
[ sync-data (parallel fetches) ] → [ parse (LLM-extracted insights) ] → [ index-vector ] → [ agent-explore ]
```

e.g. Gong (`src/integrations/gong/pipeline.ts`):

```ts
export const gongPipeline: SyncStepPipeline = [
  [{ "gong-sync-call": syncGongCallsStep }, { "gong-sync-transcript": syncGongTranscriptsStep }],
  [{ parse: parseGongStep }],
  [{ "index-vector": bindIndexVector("gong") }],
  [{ "agent-explore": bindAgentExplore("gong") }],
];
```

GitHub runs five parallel sync steps, then five parallel parse steps, then index-vector, then agent-explore. Fire-and-forget from the HTTP handler (no `await`). Each step writes `syncTask` rows. Use `bindIndexVector` / `bindAgentExplore` from `src/core/services/pipeline-helpers.ts` for the shared tail steps.

### Explore agent (`agent-explore`)

After indexing, every integration runs the shared `agentExploreContextStep` (`src/core/services/agent-explore-context-step.ts`). It spins up a `ToolLoopAgent` (`EXPLORE_MODEL` in `src/lib/constants.ts` — `deepseek/deepseek-v4-flash`) with tools from `src/core/services/tools/explore-tools.ts` (`search_semantically`, `get_artifact_by_id`, `execute_sqlite_query`, `get_tables`, `get_most_recent_records`). The agent explores the integration's data and writes a concise markdown overview to the `sourceContext` table. MCP clients load this via `get_data_source_context`. Add it as the last stage in `pipeline.ts` via `bindAgentExplore("<name>")`. Purge it in `deleteSync` via `deleteSourceContextByIntegration`.

### Pipeline runner & retrying failed steps

Step functions share a uniform signature (`IntegrationStepFn` in `src/core/models/models.ts`):

```ts
(incremental: boolean, db: SqliteDb, inputs?: any, syncTaskId?: string) => Promise<void> | void
```

- `inputs` — resume state from a failed `syncTask` (cursor, offset, etc.). When provided, paginated steps process one batch and stop (retry mode).
- `syncTaskId` — pass as `id` to `upsertSyncTask` so retries update the same row.

`getStepFn(pipeline, step)` (`src/core/services/pipeline-runner.ts`) looks up a step function by name within the integration's `syncPipeline`. Step names are the keys in each `StepMapping` object and must match the `step` strings written to `syncTask`.

`src/core/services/retry-cron.ts` (`retryFailedTasks`) scans FAILED `syncTask` rows. For each retriable task (`retries < 3`, step found in pipeline):

1. Re-invokes the failed step: `stepFunc(true, db, task.inputs, task.id)`.
2. After all failed steps for an integration are retried, resumes the **pipeline continuation** from the stage after the earliest failed step: `runSyncPipeline(pipeline, true, db, findLowestStep(pipeline, failedStepNames))`.

`runSyncPipeline` accepts an optional `stepStart` — it finds that step's stage index and begins at the **next** stage, running remaining stages sequentially. Retries are triggered by a daily cron (`Bun.cron`, disable with `CRON_ENABLED=false`) and manually via `POST /api/syncTasks/retry`.

### Scheduled syncs

Users configure per-integration sync frequency via the `syncPipeline` table (`DAILY` / `WEEKLY` / `MONTHLY` / `NO SCHEDULE`). API routes: `GET /api/sync-pipeline`, `POST /api/sync-pipeline` (body: `{ integration, frequency }`), `GET /api/sync-pipeline/:integration`, `DELETE /api/sync-pipeline/:integration`. `src/core/services/sync-new-cron.ts` (`syncNewCron`) runs daily at midnight UTC (when `CRON_ENABLED` is not `false`), checks each scheduled pipeline's `updateDate` + `frequency`, and fire-and-forgets `runSyncPipeline(integration.syncPipeline, true, db)` for integrations that are due. Manual incremental syncs (`POST /api/sync/updates/:integration`) and scheduled runs both update `syncPipeline.status` (`IDLE` / `SYNCING`).

### Cron jobs

Three `Bun.cron("0 0 * * *")` jobs in `src/index.ts`, all gated by `CRON_ENABLED !== 'false'`:

| Job | Service | What it does |
|---|---|---|
| `retryJob` | `retry-cron.ts` | Re-run FAILED steps, then resume pipeline from the next stage (up to 3 retries each) |
| `deleteStaleJob` | inline in `index.ts` | Delete `syncTask` rows older than 14 days |
| `syncPipelineJob` | `sync-new-cron.ts` | Run due scheduled incremental syncs |

Trigger retry manually with `POST /api/syncTasks/retry`.

### Rate limiting & retries

- Network/LLM calls are wrapped in `retry()` (quadratic backoff, `src/lib/utils.ts`).
- All Vercel AI Gateway calls (embeddings + LLM parsing) are throttled through a shared `bottleneck` limiter `aiGatewayBottleneck` (`src/core/services/rate-limiter.ts`, `maxConcurrent: 5`, `minTime: 200`). Schedule gateway work with `aiGatewayBottleneck.schedule(() => ...)` rather than firing concurrently — this is the pattern the sync steps use to avoid rate-limit errors.

## Models

- Embeddings: `openai/text-embedding-3-small` via the `ai` SDK (`embedMany`, `src/core/services/embedding.ts`).
- Summarization/parsing: `SUMMARIZATION_MODEL` constant (`google/gemini-3-flash`) in `src/lib/constants.ts`.
- Explore agent: `EXPLORE_MODEL` constant (`deepseek/deepseek-v4-flash`) in `src/lib/constants.ts`.
- Both route through Vercel AI Gateway, authenticated by `AI_GATEWAY_API_KEY`.
- Step types (`src/core/models/models.ts`): `IntegrationStepFn`, `StepMapping` (`{ [stepName: string]: IntegrationStepFn }`), `SyncStepPipeline` (`Array<Array<StepMapping>>`).

## MCP server

- Streamable HTTP MCP at `/mcp` (`src/core/handlers/mcp-handler.ts`). NOT wrapped in CORS middleware (MCP clients call server-side). Stateless JSON-RPC, no batching, no SSE streams.
- Tools (`src/core/services/mcp-tools.ts`): `get_integrated_data_sources`, `get_data_source_context` (auto-generated lay-of-the-land overview from the explore agent — call before searching a source), `semantic_search`, `get_md_artifact_by_id`, `showUserArtifact` (returns a shareable `/knowledge/artifact/:id` URL for the web UI — use when the user wants to view an artifact, not when you need its content), `run_sql_query` (read-only `SELECT`/`WITH...SELECT` only — mutating statements rejected), `sync_source`.

## Database

- Turso/libSQL via `drizzle-orm/tursodatabase/database` (not `bun:sqlite`). Local file `stoneturner.db` (`test-stoneturner.db` in dev mode).
- Vector tables use `vector32()` / `vector_distance_cos()`.
- Relational schemas (`src/core/db/schema/schema.ts`): `integrationCredential`, `syncTask` (includes `retries` counter for step retry), `mdArtifacts` (note table-name casing), `syncPipeline` (per-integration schedule: `frequency`, `updateDate`, `status`), `sourceContext` (explore-agent overview per integration).
- Vector schemas (`src/core/db/schema/vector-schema.ts`): `contentEmbedding`, `keyPointsEmbedding`, `questionsAnsweredEmbedding`.
- `lower()` helper in `src/lib/utils.ts` wraps raw `sql\`lower()\`` for case-insensitive text comparisons (drizzle has no native `lower`).

## Frontend

- React 19 + react-router-dom SPA, shadcn/radix, Tailwind v4, SWR for data fetching.
- Entry: `src/client/index.html` → `frontend.tsx`. Components under `src/components/stoneturner/`.
- Fetch targets inlined at build time from `process.env.BUN_PUBLIC_BACKEND_BASE_URL`.
- `bun-plugin-tailwind` wired in `build.ts` + `bunfig.toml`.

## Env

`.env.example` is sparse. Notable runtime vars:

- `AI_GATEWAY_API_KEY` — Vercel AI Gateway key for embeddings + summarization.
- `BUN_PUBLIC_BACKEND_BASE_URL` — backend URL; inlined into the frontend at build time AND used as the CORS allowlist (`src/core/middleware/middleware.ts`).
- `BUN_PUBLIC_DEV_MODE` — `"false"` uses `stoneturner.db`; anything else uses `test-stoneturner.db`.
- Per-integration OAuth/secret vars, e.g. `BUN_PUBLIC_DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` / `DISCORD_BOT_TOKEN`, `BUN_PUBLIC_GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`, `BUN_PUBLIC_NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET`, `BUN_PUBLIC_PLAUD_CLIENT_ID`.

Turso is a local file today — no remote URL/token needed.
