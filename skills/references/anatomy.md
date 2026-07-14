# Integration anatomy

## The two core types

Defined in `src/core/models/models.ts`:

```ts
export type IntegrationConfig = {
  integration: string,                                  // display + dispatch key
  icon: string,                                         // "/assets/<name>.png"
  integrationType: "BASIC_TOKEN" | "OAUTH" | "API_KEY",
  description?: string,                                 // markdown shown in the UI
  inputs?: {                                            // token/key fields the user enters
    input: "accessKey" | "baseUrl" | "secretKey",      // these are the ONLY allowed keys
    label: string,
  }[],
  optionInputs?: { key: string, label: string }[],      // extra fields → stored in `options`
  options?: Record<string, string>,                     // any non-column inputs
  oauthAuthorizationUrl?: string,                       // OAUTH only
  installUrl?: string,
};

export type Integration = {
  config: IntegrationConfig,
  syncPipeline: SyncStepPipeline,                       // array of parallel step stages
  deleteSync: (db: SqliteDb) => Promise<void> | void,   // purge everything
  handleRedirect?: (req: BunRequest, db: SqliteDb) => Promise<Response> | Response,  // OAuth callback
  refreshAccessTokens?: (db: SqliteDb) => Promise<void> | void,  // OAuth token refresh
};

export type IntegrationStepFn = (
  incremental: boolean,
  db: SqliteDb,
  inputs?: any,
  syncTaskId?: string,
) => Promise<void> | void;

export type StepMapping = { [stepName: string]: IntegrationStepFn };
export type SyncStepPipeline = Array<Array<StepMapping>>;
```

Every sync/parse/index step function matches `IntegrationStepFn`. The `inputs`
arg carries resume state from a failed `syncTask` (cursor, offset, etc.); when
present, paginated steps process one batch and stop. Pass `syncTaskId` as `id`
to `upsertSyncTask` so retries update the same row.

The `inputs[].input` union is fixed because each value maps to a column on the
shared `integrationCredential` table (`accessKey`, `secretKey`, `baseUrl`). You
cannot invent new input names; reuse these three (or use `API_KEY` /`OAUTH`,
which store `apiKey` / `accessToken` + `refreshToken`). Any other field goes in
`optionInputs` and is persisted to the `options` JSON column.

## The `db` handle is threaded everywhere

`SqliteDb` (`= BaseSQLiteDatabase<"async", any, any>`, defined in
`src/core/models/db-models.ts`) is the drizzle handle. A single instance is
created in `src/core/db/db.ts` and **passed in at the route layer**
(`src/index.ts`), then threaded down as an explicit parameter through every
`Integration` method, pipeline function, sync/parse step, and query helper. Do
**not** `import { db } from "@/core/db/db"` inside integration code — accept
`db: SqliteDb` as a parameter instead.

By convention `db` is the second positional argument (after `incremental`), before
any trailing optional args (e.g. `syncStep(incremental, db, inputs?, syncTaskId?)`,
`parseStep(incremental, db, inputs?, syncTaskId?)`, `getRows(offset, db)`,
`upsertSyncTask(task, db)`). Paginated sync steps must accept `inputs` with
resume state and write it to `syncTask.inputs` on each page so syncs can resume
after failure — see `sync-pipeline.md` and
`src/integrations/notion/sync-steps/sync-notion-pages.ts`. A few core helpers
take `db` first (`getMdArtifactsByIntegration(db, integration, offset, opts)`) —
match the signature of the helper you're calling.

## Folder layout

A complete integration (modeled on `src/integrations/gong/`):

```
src/integrations/<name>/
  config.ts             # exports the IntegrationConfig
  integration.ts        # exports the Integration (syncPipeline + lifecycle)
  pipeline.ts           # exports SyncStepPipeline (array of step-mapping stages)
  db/
    schema.ts           # drizzle tables for raw source data + Insert/Select types
    queries.ts          # batch insert / select / delete helpers
  models/
    models.ts           # TypeScript types for the external API's JSON
  sync-steps/
    sync-<thing>-step.ts
    parse-step.ts
    <name>-utils.ts     # optional: credential/url helpers, token refresh
```

## Example config (`config.ts`)

Gong (`src/integrations/gong/config.ts`) uses `BASIC_TOKEN`:

```ts
import type { IntegrationConfig } from "@/core/models/models";

export const gongConfig: IntegrationConfig = {
  integration: "Gong",
  icon: "/assets/gong.png",
  integrationType: "BASIC_TOKEN",
  description: "Connect your data integration via a basic token found in your Gong settings. Visit the [Gong docs](https://help.gong.io/docs/receive-access-to-the-api) for further instruction.",
  inputs: [
    { input: "accessKey", label: "Access Key" },
    { input: "secretKey", label: "Access Key Secret" },
    { input: "baseUrl",   label: "Gong API Base URL" },
  ],
};
```

## Example pipeline (`pipeline.ts`) + Integration (`integration.ts`)

Gong (`src/integrations/gong/pipeline.ts` + `integration.ts`):

```ts
// pipeline.ts
import type { StepMapping, SyncStepPipeline } from "@/core/models/models";
import { bindAgentExplore, bindIndexVector } from "@/core/services/pipeline-helpers";
import { parseGongStep } from "./sync-steps/parse-step";
import { syncGongCallsStep } from "./sync-steps/sync-calls-step";
import { syncGongTranscriptsStep } from "./sync-steps/sync-transcripts-step";

const gongSyncCall: StepMapping = { "gong-sync-call": syncGongCallsStep };
const gongSyncTranscript: StepMapping = { "gong-sync-transcript": syncGongTranscriptsStep };
const parse: StepMapping = { parse: parseGongStep };
const indexVector: StepMapping = { "index-vector": bindIndexVector("gong") };
const agentExplore: StepMapping = { "agent-explore": bindAgentExplore("gong") };

export const gongPipeline: SyncStepPipeline = [
  [gongSyncCall, gongSyncTranscript],
  [parse],
  [indexVector],
  [agentExplore],
];

// integration.ts
import type { Integration } from "@/core/models/models";
import { gongConfig } from "./config";
import { gongPipeline } from "./pipeline";
import { deleteMdArtifactsByIntegration, deleteSourceContextByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { deleteAllGongData } from "./db/queries";
import type { SqliteDb } from "@/core/models/db-models";

export const gongIntegration: Integration = {
  config: gongConfig,
  syncPipeline: gongPipeline,
  deleteSync: async (db: SqliteDb) => {
    await deleteSyncTasksByIntegration("gong", db);
    await deleteMdArtifactsByIntegration("gong", db);
    await deleteEmbeddingByIntegration("gong", db);
    await deleteSourceContextByIntegration("gong", db);
    await deleteAllGongData(db);
  },
};
```

Routes call `runSyncPipeline(integration.syncPipeline, incremental, db)` —
full sync passes `incremental: false`, incremental/scheduled syncs pass `true`.

Note the five delete calls in `deleteSync`: syncTasks, mdArtifacts, embeddings,
sourceContext, and the integration's own tables. The first four helpers are
shared; the last one you write in your `db/queries.ts`.

## Raw-data schema (`db/schema.ts`)

Drizzle tables over Turso/libSQL (`drizzle-orm/sqlite-core`). Give each row a
stable unique business key and a UUID primary key. From
`src/integrations/gong/db/schema.ts`:

```ts
import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const gongCall = sqliteTable("gongCall", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  callId: text("callId").unique().notNull(),       // stable source key
  title: text("title"),
  started: text("started"),
  // ...
}, (table) => [
  uniqueIndex("gongCall_callId_unique_idx").on(table.callId),
]);

export type GongCallSelect = InferSelectModel<typeof gongCall>;
export type GongCallInsert = InferInsertModel<typeof gongCall>;
```

Store nested JSON with `text("col", { mode: "json" }).$type<MyType[]>()` (see
`gongTranscript.transcript`).

## Idempotent inserts (`db/queries.ts`)

Use `onConflictDoUpdate` keyed on the unique business key so re-syncs upsert
rather than duplicate (`src/integrations/gong/db/queries.ts`):

Note: `db` is **not** imported here — it arrives as a parameter (see "The `db`
handle is threaded everywhere" above).

```ts
import { sql } from "drizzle-orm";
import type { SqliteDb } from "@/core/models/db-models";

export const batchInsertGongCall = async (calls: GongCallInsert[], db: SqliteDb): Promise<void> => {
  await db.insert(gongCall).values(calls).onConflictDoUpdate({
    target: gongCall.callId,
    set: { title: sql`excluded.title`, started: sql`excluded.started` /* ... */ },
  });
};

export const deleteAllGongData = async (db: SqliteDb): Promise<void> => {
  await db.delete(gongTranscript);
  await db.delete(gongCall);
};
```

## Register the schema with drizzle (`drizzle.config.ts`)

Add your schema path so migrations pick up the new tables:

```ts
export default defineConfig({
  schema: [
    './src/core/db/schema/*',
    './src/integrations/gong/db/schema.ts',
    './src/integrations/<name>/db/schema.ts',   // add yours
  ],
  out: './migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.BUN_PUBLIC_DEV_MODE === "false" ? 'file:stoneturner.db' : 'file:test-stoneturner.db',
  },
});
```

## Register the integration

Two registries, both in `src/integrations/`:

```ts
// config-registry.ts  (drives the frontend UI)
export const configRegistry: IntegrationConfig[] = [gongConfig, /* ... */ myConfig];

// integration-registry.ts  (drives sync dispatch + retry lookup)
export const supportedIntegrations: Integration[] = [gongIntegration, /* ... */ myIntegration];
```

The `syncPipeline` on each `Integration` is the single source of truth for
both sync execution and retry step lookup. `getStepFn(pipeline, step)` in
`src/core/services/pipeline-runner.ts` finds a step function by name within the
pipeline array. Step names are the keys in each `StepMapping` object and must
match the `step` strings written to `syncTask`.

The retry cron (`src/core/services/retry-cron.ts`) re-invokes failed steps, then
resumes the pipeline from the stage after the earliest failed step via
`runSyncPipeline(pipeline, true, db, findLowestStep(pipeline, failedStepNames))`.

## How routes find your integration

`src/index.ts` matches the `:integration` path param against
`config.integration` case-insensitively — no per-integration route wiring:

The shared `db` (imported from `@/core/db/db` in `src/index.ts`) is passed into
the dispatched method — that is where the threading starts:

```ts
import { db } from "./core/db/db";
import { runSyncPipeline } from "./core/services/pipeline-runner";
// ...
const target = decodeURIComponent(req.params.integration).toLowerCase();
const index = supportedIntegrations.findIndex(
  (integ) => integ.config.integration.toLowerCase() === target);
runSyncPipeline(supportedIntegrations[index]!.syncPipeline, false, db);  // fire-and-forget
```

| Route | Method | Calls |
|---|---|---|
| `/api/sync/:integration` | POST | `runSyncPipeline(syncPipeline, false, db)` |
| `/api/sync/updates/:integration` | POST | `runSyncPipeline(syncPipeline, true, db)` |
| `/api/sync/:integration` | DELETE | `deleteSync(db)` |
| `/api/oauth/:integration` | GET | `handleRedirect(req, db)` |
| `/api/sync-pipeline` | GET / POST | list / configure scheduled sync frequency |
| `/api/sync-pipeline/:integration` | GET / DELETE | get / remove schedule for one integration |
| `/api/syncTasks/retry` | POST | manually trigger retry of FAILED tasks |
