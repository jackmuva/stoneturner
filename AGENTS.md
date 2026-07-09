# AGENTS.md

Read `CLAUDE.md` first — it is the canonical architecture doc. Below are gotchas and corrections that are not obvious from those docs.

## Cursor Cloud specific instructions

Standard commands and architecture are documented in `CLAUDE.md` and `README.md` — read those first. Notes below are cloud/dev-environment caveats that aren't obvious from those docs.

### Runtime & setup
- The project runs on **Bun** (not Node/npm). Bun is pre-installed on the VM snapshot and symlinked at `/usr/local/bin/bun`, so it is on `PATH` in any shell. The startup update script only runs `bun install`.
- The database is an embedded local file (`stoneturner.db`), created by `bun run migrate`. This file (and `.env`) are gitignored and persist in the VM snapshot, so migrations do not need re-running unless new migrations are added. Run `bun run generate && bun run migrate` after changing any schema.

### Running & ports
- `bun dev` runs the whole product (React SPA + REST API + MCP server) as one process on port **9000**.
- The dev server inlines `BUN_PUBLIC_*` at bundle time. After editing `.env` (or these config files), restart `bun dev` for changes to take effect in the browser — HMR alone does not re-inline env values reliably.

### Failed sync step retries
- Failed `syncTask` rows are retried via `src/core/services/retry-cron.ts`, which looks up step functions in `src/integrations/step-registry.ts`.
- Retries run on a daily cron (midnight UTC) unless `CRON_ENABLED=false`. Trigger manually with `POST /api/syncTasks/retry`.
- Each task retries up to 3 times (`syncTask.retries`). Steps resume from `syncTask.inputs` (cursor/offset) and update the same row via `syncTaskId`.

### Scheduled syncs
- Per-integration sync frequency is stored in the `syncPipeline` table (`DAILY` / `WEEKLY` / `MONTHLY` / `NO SCHEDULE`).
- Configure via `POST /api/sync-pipeline` (body: `{ integration, frequency }`); list with `GET /api/sync-pipeline`.
- `src/core/services/sync-new-cron.ts` runs due incremental syncs daily at midnight UTC (same `CRON_ENABLED` gate).

### Explore agent
- After each sync pipeline completes, `agentExploreContextStep` (`src/core/services/agent-explore-context-step.ts`) runs an LLM agent that explores the integration's data and writes a lay-of-the-land markdown overview to `sourceContext`.
- MCP clients load this via `get_data_source_context`. New integrations must call `agentExploreContextStep` at the end of their pipeline, register `"agent-explore"` in `steps.ts`, and purge with `deleteSourceContextByIntegration` in `deleteSync`.

## Runtime & commands (general)
- **Bun** is the runtime (not Node/npm). All commands use `bun`.
- `bun run lint` = `bun tsc --noEmit` — there is no ESLint, this is the only lint step.
- `bun run generate && bun run migrate` after changing any DB schema.

## `.env` footgun
- Frontend inlines `BUN_PUBLIC_*` at bundle time. Any referenced var missing from `.env` becomes raw `process.env.…` in the browser → `ReferenceError: process is not defined`.
- All frontend-referenced vars **must** be present (empty value is fine): `BUN_PUBLIC_BACKEND_BASE_URL`, `BUN_PUBLIC_DEV_MODE`, `BUN_PUBLIC_DISCORD_CLIENT_ID`, `BUN_PUBLIC_GITHUB_CLIENT_ID`, `BUN_PUBLIC_NOTION_CLIENT_ID`, `BUN_PUBLIC_PLAUD_CLIENT_ID`, `BUN_PUBLIC_SLACK_CLIENT_ID`, `BUN_PUBLIC_SPOTIFY_CLIENT_ID`, `BUN_PUBLIC_TWITTER_CLIENT_ID`.
- After editing `.env`, restart `bun dev` — HMR does not re-inline env values.
- `AI_GATEWAY_API_KEY` is only needed for sync→parse→embed. The server starts and serves UI/MCP without it.

## Stale reference in CLAUDE.md
CLAUDE.md may reference `src/integrations/sync-registry.ts`. The actual file is `src/integrations/integration-registry.ts`. When adding an integration, register in `integration-registry.ts` (not `sync-registry.ts`).

## Adding an integration
Register an integration in **four** places:
1. `src/integrations/config-registry.ts` — frontend UI config
2. `src/integrations/integration-registry.ts` — sync dispatch
3. `src/integrations/step-registry.ts` — retry step lookup
4. `drizzle.config.ts` schema array — so `drizzle-kit` picks up new tables

There is an integration scaffold skill at `skills/SKILL.md`.

## Architecture notes
- `bun dev` runs on port **9000** (React SPA + REST API + MCP server, one process).
- `@/*` alias → `src/*`.
- Database is Turso/libSQL via `drizzle-orm/tursodatabase/database`, NOT `bun:sqlite`. Local file only — no remote DB URL needed.
- `BUN_PUBLIC_DEV_MODE=true` switches DB to `test-stoneturner.db` (see `src/core/db/db.ts`).
- MCP server at `/mcp` — Streamable HTTP, no batching, no SSE, **NOT** wrapped in CORS.
- AI Gateway calls (embeddings + LLM) throttle through `aiGatewayBottleneck` (5 concurrent, 200ms minTime). Use `.schedule()` for gateway work.
- Three daily CRON jobs at midnight UTC in `src/index.ts` (all disabled when `CRON_ENABLED=false`): retry failed tasks (`retry-cron.ts`), delete stale sync tasks >14 days, run scheduled syncs (`sync-new-cron.ts`).

## Scripts
`scripts/` contains one-off importers (`import-gong-calls.ts`, `import-gong-transcripts.ts`, `import-md-artifacts.ts`, `import-sync-tasks.ts`, `csv-stream.ts`). Run with `bun scripts/<file>.ts`.
