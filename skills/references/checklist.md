# End-to-end checklist

Work top to bottom. File paths assume the integration is named `<name>` (use the
exact `config.integration` string consistently everywhere it appears).

## Files to create

- [ ] `src/integrations/<name>/config.ts` — export `<name>Config: IntegrationConfig`.
- [ ] `src/integrations/<name>/models/models.ts` — types for the external API JSON.
- [ ] `src/integrations/<name>/db/schema.ts` — drizzle tables (unique business key per row) + `InferInsert/SelectModel` exports.
- [ ] `src/integrations/<name>/db/queries.ts` — `batchInsert*` (with `onConflictDoUpdate`), `get*`, `getLatest*`/`getMostRecent*` (for incremental), and a `delete*Data` that purges your tables.
- [ ] `src/integrations/<name>/sync-steps/sync-*-step.ts` — fetch + insert; paginated; `retry()`-wrapped; logs `syncTask`.
- [ ] `src/integrations/<name>/sync-steps/parse-step.ts` — raw rows → `upsertMdArtifact`; LLM via `aiGatewayBottleneck.schedule(...)`.
- [ ] `src/integrations/<name>/integration.ts` — `syncPipeline(incremental)` + the `Integration` object (incl. `deleteSync`).
- [ ] OAuth only: `handleRedirect` + `refreshAccessTokens` (see `auth.md`).

## Files to edit

- [ ] `drizzle.config.ts` — add `'./src/integrations/<name>/db/schema.ts'` to `schema`.
- [ ] `src/integrations/config-registry.ts` — add `<name>Config` to `configRegistry`.
- [ ] `src/integrations/sync-registry.ts` — add `<name>Integration` to `supportedIntegrations`.
- [ ] `.env` — add any OAuth/secret vars (e.g. `BUN_PUBLIC_<NAME>_CLIENT_ID`, `<NAME>_CLIENT_SECRET`).
- [ ] Add the icon at `src/assets/<name>.png` to match `config.icon`.

## `deleteSync` must purge all four

```ts
await deleteSyncTasksByIntegration("<name>");     // @/core/db/queries/queries
await deleteMdArtifactsByIntegration("<name>");   // @/core/db/queries/queries
await deleteEmbeddingByIntegration("<name>");     // @/core/db/queries/vector-queries
await delete<Name>Data();                          // your own db/queries.ts
```

## Commands

```bash
bun run generate     # schema → migration files (drizzle-kit generate)
bun run migrate      # apply pending migrations
bunx tsc --noEmit    # typecheck (there is no lint script)
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

## Common gotchas

- The integration string on `mdArtifact`, `syncTask`, and the argument to
  `indexVectorDbStep(...)` must all equal `config.integration` — they're matched
  as plain strings (route matching is case-insensitive, internal joins are not).
- Don't `await` the sync from a handler — it's fire-and-forget; all errors must
  be caught inside steps and logged as FAILED `syncTask`s.
- Don't fork `index-vector-db-step.ts`; call the shared one.
- The middleware dir is spelled `middlware/` — intentional.
- Every AI Gateway call (embeddings + LLM) must go through `aiGatewayBottleneck`.
- Give each artifact a stable `integrationArtifactId` so re-syncs upsert instead
  of duplicating, and so the parse step's unchanged-markdown skip works.
