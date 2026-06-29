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
- `src/core/` — shared plumbing; `src/integrations/<name>/` — one folder per integration (gong, discord, notion, plaud, firecrawl).
- Bun-first: `Bun.serve()`, `Bun.file`, `bunx`. No express/vite/webpack. Exception: database is Turso/libSQL via Drizzle (`@tursodatabase/database`), not `bun:sqlite`.

### Adding an integration

Create `src/integrations/<name>/` with `config.ts`, `integration.ts`, `db/`, `models/`, `sync-steps/`. Export an `IntegrationConfig` and an `Integration` (`src/core/models/models.ts`). The `Integration` interface:

- `sync()` — full sync, `syncUpdates()` — incremental sync (both usually call one pipeline fn with an `incremental` flag), `deleteSync()` — purge syncTasks + artifacts + embeddings + integration tables.
- optional `handleRedirect(req)` — OAuth callback, `refreshAccessTokens()`.

Then register in `src/integrations/sync-registry.ts` (sync dispatch), `src/integrations/config-registry.ts` (frontend UI), and add the integration's `db/schema.ts` to the `schema` array in `drizzle.config.ts` so migrations pick it up. Routes in `src/index.ts` dispatch by matching the `:integration` path param against `config.integration` (case-insensitive): `POST /api/sync/:integration` → `sync()`, `DELETE` → `deleteSync()`, `POST /api/sync/updates/:integration` → `syncUpdates()`, `GET /api/oauth/:integration` → `handleRedirect()`.

There is a `build-stoneturner-integration` skill (`skills/`) that scaffolds a new integration end-to-end; `integration-specs/` holds per-integration spec docs (e.g. `firecrawl-spec.md`, `plaud-spec.md`) used as input when building one.

## Sync pipeline

```
sync-data (parallel fetches) → parse (LLM-extracted insights) → index-vector (embed + upsert)
```

e.g. Gong: `sync-calls + sync-transcripts (parallel) → parse → index-vector`. Fire-and-forget from the HTTP handler (no `await`). Each step writes `syncTask` rows.

### Rate limiting & retries

- Network/LLM calls are wrapped in `retry()` (quadratic backoff, `src/lib/utils.ts`).
- All Vercel AI Gateway calls (embeddings + LLM parsing) are throttled through a shared `bottleneck` limiter `aiGatewayBottleneck` (`src/core/services/rate-limiter.ts`, `maxConcurrent: 5`, `minTime: 200`). Schedule gateway work with `aiGatewayBottleneck.schedule(() => ...)` rather than firing concurrently — this is the pattern the sync steps use to avoid rate-limit errors.

## Models

- Embeddings: `openai/text-embedding-3-small` via the `ai` SDK (`embedMany`, `src/core/services/embedding.ts`).
- Summarization/parsing: `SUMMARIZATION_MODEL` constant (`google/gemini-3-flash`) in `src/lib/constants.ts`.
- Both route through Vercel AI Gateway, authenticated by `AI_GATEWAY_API_KEY`.

## MCP server

- Streamable HTTP MCP at `/mcp` (`src/core/handlers/mcp-handler.ts`). NOT wrapped in CORS middleware (MCP clients call server-side). Stateless JSON-RPC, no batching, no SSE streams.
- Tools (`src/core/services/mcp-tools.ts`): `semantic_search`, `get_md_artifact_by_id`, `run_sql_query` (read-only `SELECT`/`WITH...SELECT` only — mutating statements rejected), `get_integration_sources`, `sync_source`.

## Database

- Turso/libSQL via `drizzle-orm/tursodatabase/database` (not `bun:sqlite`). Local file `stoneturner.db` (`test-stoneturner.db` in dev mode).
- Vector tables use `vector32()` / `vector_distance_cos()`.
- Relational schemas (`src/core/db/schema/schema.ts`): `integrationCredential`, `syncTask`, `mdArtifacts` (note table-name casing).
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
- Per-integration OAuth/secret vars, e.g. `BUN_PUBLIC_DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` / `DISCORD_BOT_TOKEN`, `BUN_PUBLIC_NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET`.

Turso is a local file today — no remote URL/token needed.
