# End-to-end checklist

Work top to bottom. File paths assume the integration is named `<name>` (use the
exact `config.integration` string consistently everywhere it appears).

Every query helper, sync/parse step, pipeline fn, and `Integration` method takes
the shared `db: SqliteDb` (`@/core/models/db-models`) as a parameter — thread it
down, never `import { db }`. See `anatomy.md` → "The `db` handle is threaded
everywhere".

## Files to create

- [ ] `src/integrations/<name>/config.ts` — export `<name>Config: IntegrationConfig`.
- [ ] `src/integrations/<name>/models/models.ts` — types for the external API JSON.
- [ ] `src/integrations/<name>/db/schema.ts` — drizzle tables (unique business key per row) + `InferInsert/SelectModel` exports.
- [ ] `src/integrations/<name>/db/queries.ts` — `batchInsert*` (with `onConflictDoUpdate`), `get*`, `getLatest*`/`getMostRecent*` (for incremental), and a `delete*Data` that purges your tables. Each takes `db: SqliteDb`.
- [ ] `src/integrations/<name>/sync-steps/sync-*-step.ts` — fetch + insert; paginated; `retry()`-wrapped; logs `syncTask` with cursor in `inputs`; uses `withSyncTaskId`. Signature `(incremental, db, cursor?, syncTaskId?)` (typed object when pagination is multi-dimensional).
- [ ] `src/integrations/<name>/sync-steps/parse-step.ts` — raw rows → `upsertMdArtifact`; LLM via `aiGatewayBottleneck.schedule(...)`; uses `withSyncTaskId`. Signature `(db, offset?, syncTaskId?)`.
- [ ] `src/integrations/<name>/<name>Steps.ts` — `IntegrationSteps` mapping each `syncTask.step` to a retryable function.
- [ ] `src/integrations/<name>/integration.ts` — `syncPipeline(incremental, db)` + the `Integration` object (incl. `deleteSync(db)`).
- [ ] OAuth only: `handleRedirect(req, db)` + `refreshAccessTokens(db)` (see `auth.md`).

## Files to edit

- [ ] `drizzle.config.ts` — add `'./src/integrations/<name>/db/schema.ts'` to `schema`.
- [ ] `src/integrations/config-registry.ts` — add `<name>Config` to `configRegistry`.
- [ ] `src/integrations/integration-registry.ts` — add `<name>Integration` to `supportedIntegrations`.
- [ ] `src/integrations/step-registry.ts` — add `<name>Steps` to `stepRegistry`.
- [ ] `.env` — add any OAuth/secret vars (e.g. `BUN_PUBLIC_<NAME>_CLIENT_ID`, `<NAME>_CLIENT_SECRET`).
- [ ] Add the icon at `src/assets/<name>.png` to match `config.icon`.

## `deleteSync` must purge all four

```ts
await deleteSyncTasksByIntegration("<name>", db);   // @/core/db/queries/queries
await deleteMdArtifactsByIntegration("<name>", db); // @/core/db/queries/queries
await deleteEmbeddingByIntegration("<name>", db);   // @/core/db/queries/vector-queries
await delete<Name>Data(db);                          // your own db/queries.ts
```

## Commands

```bash
bun run generate     # schema → migration files (drizzle-kit generate)
bun run migrate      # apply pending migrations
bun run lint         # typecheck (bun tsc --noEmit; the only "lint")
bun dev              # hot-reload server on :9000
```

Set `BUN_PUBLIC_DEV_MODE=true` to iterate against `test-stoneturner.db` instead
of `stoneturner.db`.

## Manual smoke test

1. Start `bun dev`.
2. Add credentials via the web UI (or `upsertIntegrationCredential` directly /
   the OAuth flow for OAUTH).
3. Trigger a full sync: `curl -X POST http://localhost:9000/api/sync/<name>`.
   (Incremental: `POST /api/sync/updates/<name>`.)
4. Watch progress — `syncTask` rows in the UI, or query the DB. You should see
   `<your sync step>` → `parse` → `index-vector` rows transition to SUCCESS.
5. Confirm `mdArtifacts` rows exist and `contentEmbedding` /
   `keyPointsEmbedding` / `questionsAnsweredEmbedding` got populated.
6. From an MCP client, run `semantic_search` and confirm your content is
   retrievable (optionally filter by `integration: "<name>"`).
7. Test teardown: `curl -X DELETE http://localhost:9000/api/sync/<name>` and
   confirm all four data classes are gone.
8. Test retries: force a FAILED `syncTask` (or wait for one), then click
   "Retry failed tasks" in the UI or `POST /api/syncTasks/retry`. Confirm the
   task re-runs from its saved cursor/offset and `retries` increments.

## Common gotchas

- The integration string on `mdArtifact`, `syncTask`, and the argument to
  `indexVectorDbStep(...)` must all equal `config.integration` — they're matched
  as plain strings (route matching is case-insensitive, internal joins are not).
- Don't `await` the sync from a handler — it's fire-and-forget; all errors must
  be caught inside steps and logged as FAILED `syncTask`s.
- Don't fork `index-vector-db-step.ts`; call the shared one.
- Don't `import { db } from "@/core/db/db"` in integration code — accept
  `db: SqliteDb` as a parameter and thread it through.
- Every AI Gateway call (embeddings + LLM) must go through `aiGatewayBottleneck`.
- Paginated steps must stop after one page when a cursor is passed (retry mode).
- Register every `syncTask.step` string in `<name>Steps.ts` and `step-registry.ts` so failed tasks can be retried.
- Use `withSyncTaskId` on every `upsertSyncTask` so retries update the same row.
- Give each artifact a stable `integrationArtifactId` so re-syncs upsert instead
  of duplicating, and so the parse step's unchanged-markdown skip works.
