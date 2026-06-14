# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Stoneturner ingests data from third-party integrations (currently Gong call recordings), turns each artifact into a markdown summary with LLM-extracted metadata, and indexes it into a Chroma vector DB for semantic search. A React SPA lets users register integration credentials and trigger syncs.

## Commands

- `bun dev` — run the server with hot reload (`bun --hot src/index.ts`)
- `bun start` — run the server without hot reload
- `bun run build` — bundle the frontend to `dist/` via `build.ts` (uses `bun-plugin-tailwind`; scans `src/**/*.html`)
- `bun test` — run tests (no test files exist yet)

There is no lint/typecheck script wired up; run `bunx tsc --noEmit` for a type check.

## Runtime conventions (enforced)

- Bun-first. Use Bun APIs, not Node/npm equivalents — see the detailed list at the bottom of this file. Notably: `bun:sqlite` (not better-sqlite3), `Bun.serve()` (not express), `Bun.file`, `bunx`. Bun auto-loads `.env`; do not add `dotenv` (it's a leftover dependency).
- The single `Bun.serve()` instance lives in `src/index.ts`. Add routes there. HTML imports drive the frontend bundle — `src/client/index.html` → `frontend.tsx`.
- `@/*` path alias maps to `src/*` (tsconfig). Use it for imports.
- TypeScript is strict, including `noUncheckedIndexedAccess` — array/object index access is `T | undefined`, hence the `!` assertions throughout the sync code.

## Architecture

### Core vs. integrations

- `src/core/` — integration-agnostic plumbing: DB client + shared tables (`db/`), HTTP handlers (`handlers/`), CORS middleware (`middlware/` — note spelling), Chroma + embedding services (`services/`), shared types (`models/`).
- `src/integrations/<name>/` — one folder per integration, mirroring the core layout (`db/`, `handlers/`, `models/`, `sync-steps/`, `sync.ts`). Gong is the only one today and is the template for adding more.
- To add an integration: create the folder structure, register it in `SupportedIntegrations` in `src/lib/constants.ts` (drives the frontend's connect UI), add its sync route in `src/index.ts`, and write a `sync.ts` pipeline.

### The sync pipeline (Gong)

`syncGongPipeline()` in `src/integrations/gong/sync.ts` runs four ordered steps:

1. **sync-calls** + **sync-transcripts** (in parallel) — page through the Gong REST API and upsert raw rows into `gongCall` / `gongTranscript`. Incremental mode resumes from the latest stored `started` timestamp.
2. **parse** — for each transcript, build a speaker-labeled markdown doc, then call the LLM (`SUMMARIZATION_MODEL`, via the Vercel AI SDK `generateText` + `Output.object`) to extract `keyPoints`, `questionsAnswered`, and `entities`. Stored as a row in the shared `mdArtifacts` table. Skips re-summarizing when the markdown is unchanged.
3. **index-vector** — chunk each artifact's markdown (`chunkLines`, ~250 words/chunk) and upsert into three Chroma collections: `stoneturner-core` (chunks), `stoneturner-core-qa` (questions answered), `stoneturner-core-kp` (key points). Sets `lastIndex` so artifacts aren't re-indexed.

Both `parse` and `index-vector` parallelize across `MAX_WORKERS` (5) offset windows of `PAGE_SIZE` (10), looping until a page comes back short. Tune both in `src/lib/constants.ts`.

Every step writes a `syncTask` row (`SUCCESS`/`FAILED`, with `step` and JSON `inputs`) for observability; the frontend polls `getSyncTasksByIntegrationAndUpdateDateAfter`. Network/LLM calls are wrapped in `retry()` (`src/lib/utils.ts`) with quadratic backoff. The sync handler kicks off the pipeline fire-and-forget (no `await`) and returns 200 immediately.

### Data stores

- **SQLite** (`stoneturner.db`, opened in `src/core/db/queries.ts`) via Drizzle ORM. The exported `db` client is shared by core and integration query modules. Schemas: `integrationCredential`, `syncTask`, `mdArtifacts` (core) and `gongCall`, `gongTranscript` (Gong).
- **No migration tooling is set up.** `drizzle-kit` is a dependency but there is no `drizzle.config`, no `migrations/`, and no generate/push script. Schema changes are not auto-applied — tables must be created/altered manually for now.
- **Chroma Cloud** via `CloudClient()` (`src/core/services/chroma.ts`). Collections are lazily created singletons. The embedding function (`VercelEmbeddingFunction`) delegates to the Vercel AI SDK `embedMany` with `openai/text-embedding-3-small`.

### Frontend

React 19 + react-router-dom SPA in `src/client/` and `src/components/`. UI is shadcn/radix (`components/ui/`) with Tailwind v4; app-specific views under `components/stoneturner/`. The client talks to the API via `fetch` against `process.env.BACKEND_BASE_URL` / `NEXT_PUBLIC_BACKEND_BASE_URL` (inlined at build time).

## Environment variables

`.env.example` is empty; the code expects: `CHROMA_*` (read by `CloudClient`), an OpenAI key for embeddings + the AI SDK provider key for `SUMMARIZATION_MODEL`, `FRONTEND_BASE_URL` (CORS allowlist in middleware), and `BACKEND_BASE_URL` / `NEXT_PUBLIC_BACKEND_BASE_URL` (frontend fetch targets).

## Known rough edges

- Frontend `integration-card.tsx` POSTs to `/api/sync/gong`, but the server registers `/api/workflow/sync/gong` — these don't match.
- The app is single-tenant in practice: query helpers reference a `userId` and Chroma filters by it, but no auth/user is wired up, so the SQLite layer doesn't actually scope by user yet.

---

## Bun API reference (project default — use these, not Node equivalents)

- `bun <file>` not `node`/`ts-node`; `bun install`/`bun run`/`bunx` not npm/yarn/pnpm/npx.
- `bun:sqlite` for SQLite; `Bun.sql` for Postgres; `Bun.redis` for Redis; `Bun.file` over `node:fs` read/writeFile; `Bun.$\`...\`` over execa; built-in `WebSocket` over `ws`.
- `Bun.serve()` supports routes, WebSockets, and HTTPS — don't add express. HTML imports support React/CSS/Tailwind; don't add vite/webpack/esbuild.
- Bun API docs are in `node_modules/bun-types/docs/**.mdx`.
</content>
</invoke>
