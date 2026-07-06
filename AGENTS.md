# AGENTS.md

## Cursor Cloud specific instructions

Standard commands and architecture are documented in `CLAUDE.md` and `README.md` — read those first. Notes below are cloud/dev-environment caveats that aren't obvious from those docs.

### Runtime & setup
- The project runs on **Bun** (not Node/npm). Bun is pre-installed on the VM snapshot and symlinked at `/usr/local/bin/bun`, so it is on `PATH` in any shell. The startup update script only runs `bun install`.
- The database is an embedded local file (`stoneturner.db`), created by `bun run migrate`. This file (and `.env`) are gitignored and persist in the VM snapshot, so migrations do not need re-running unless new migrations are added. Run `bun run generate && bun run migrate` after changing any schema.

### `.env` gotcha (important)
- `.env` is created from `.env.example`. There is a non-obvious footgun: the frontend bundle references `BUN_PUBLIC_*` vars directly in `src/integrations/*/config.ts`. Bun only inlines env vars that are **defined**; any referenced `BUN_PUBLIC_*` var that is missing from `.env` is left as a raw `process.env.…` in the browser bundle and throws `ReferenceError: process is not defined`, which blanks the entire React app.
- `.env.example` is missing `BUN_PUBLIC_PLAUD_CLIENT_ID`, so `.env` must define it (empty value is fine). All frontend-referenced vars must be present in `.env`: `BUN_PUBLIC_BACKEND_BASE_URL`, `BUN_PUBLIC_DEV_MODE`, `BUN_PUBLIC_DISCORD_CLIENT_ID`, `BUN_PUBLIC_GITHUB_CLIENT_ID`, `BUN_PUBLIC_NOTION_CLIENT_ID`, `BUN_PUBLIC_PLAUD_CLIENT_ID`.
- `AI_GATEWAY_API_KEY` is only needed for the sync → parse → embed → `semantic_search` pipeline. The server starts, serves the UI/MCP, and can register integration credentials without it.

### Running & ports
- `bun dev` runs the whole product (React SPA + REST API + MCP server) as one process on port **9000**.
- The dev server inlines `BUN_PUBLIC_*` at bundle time. After editing `.env` (or these config files), restart `bun dev` for changes to take effect in the browser — HMR alone does not re-inline env values reliably.

### Failed-task retries
- Failed sync steps can be retried via the Sync Monitoring UI ("Retry failed tasks") or `POST /api/syncTasks/retry`. A daily cron also runs `retryFailedTasks` unless `CRON_ENABLED=false`.
- Retries require the integration's steps to be registered in `src/integrations/step-registry.ts`. Each step must accept an optional `syncTaskId` and use `withSyncTaskId` when upserting `syncTask` rows. See `CLAUDE.md` → "Step registry".
