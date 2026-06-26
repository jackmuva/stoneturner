# AGENTS.md

## Commands

- `bun dev` — run server with hot reload (`bun --hot src/index.ts`)
- `bun run build` — bundle frontend to `dist/`
- `bun start` — production server
- `bunx tsc --noEmit` — typecheck (no lint script exists)
- `bun run generate` — `drizzle-kit generate` (schema → migration files)
- `bun run migrate` — `drizzle-kit migrate` (apply pending migrations)
- No test files exist yet

## Architecture

- `src/index.ts` — single `Bun.serve()` with routes + HMIR in dev, port 9000.
- `@/*` alias → `src/*`.
- `src/core/` — shared plumbing; `src/integrations/<name>/` — one folder per integration
- To add an integration: create folder with `config.ts`, `db/`, `handlers/`, `models/`, `sync-steps/`, export `IntegrationConfig` + `Integration`, register in both `src/integrations/config-registry.ts` (frontend UI) and `src/integrations/sync-registry.ts` (sync dispatch), add route in `src/index.ts`.
- Directory is actually called `middlware/` (typo, not `middleware/`).
- Bun-first: `Bun.serve()`, `Bun.file`, `bunx`. No express/vite/webpack. Exception: database is Turso/libSQL via Drizzle (`@tursodatabase/database`), not `bun:sqlite`.

## Sync pipeline

```
sync-calls + sync-transcripts (parallel) → parse → index-vector
```

Fire-and-forget from HTTP handler (no `await`). Each step writes `syncTask` rows. Network/LLM calls wrapped in `retry()` (quadratic backoff, `src/lib/utils.ts`).

## MCP server

- Streamable HTTP MCP at `/mcp`. NOT wrapped in CORS middleware (MCP clients call server-side).
- Tools: `semantic_search`, `get_md_artifact_by_id`, `get_integration_sources`, `sync_source`.
- JSON-RPC, no batching, no SSE streams.

## Database

- Turso/libSQL via `drizzle-orm/tursodatabase/database` (not `bun:sqlite`).
- Local file `stoneturner.db`. Vector tables use `vector32()` / `vector_distance_cos()`.
- Relational schemas: `integrationCredential`, `syncTask`, `mdArtifacts` (note table name — upper/lower casing).
- Vector schemas: `contentEmbedding`, `keyPointsEmbedding`, `questionsAnsweredEmbedding`.

## Frontend

- React 19 + react-router-dom SPA, shadcn/radix, Tailwind v4.
- Entry: `src/client/index.html` → `frontend.tsx`.
- Fetch targets inlined at build time from `process.env.BUN_PUBLIC_BACKEND_BASE_URL`.
- `bun-plugin-tailwind` in `build.ts` + `bunfig.toml`.

## Env

`.env.example` is sparse. Required at runtime: `API_GATEWAY_API_KEY` for embeddings + provider key for `SUMMARIZATION_MODEL` (defaults to `zai/glm-5`), `FRONTEND_BASE_URL` (CORS allowlist), `BUN_PUBLIC_BACKEND_BASE_URL`. Turso is local-file today, no remote URL/token needed.
