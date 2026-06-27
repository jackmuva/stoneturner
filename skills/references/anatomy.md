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
  oauthAuthorizationUrl?: string,                       // OAUTH only
  installUrl?: string,
};

export type Integration = {
  config: IntegrationConfig,
  sync: () => Promise<void> | void,                     // full sync
  syncUpdates: () => Promise<void> | void,              // incremental sync
  deleteSync: () => Promise<void> | void,               // purge everything
  handleRedirect?: (req: BunRequest) => Promise<Response> | Response,  // OAuth callback
  refreshAccessTokens?: () => Promise<void> | void,     // OAuth token refresh
};
```

The `inputs[].input` union is fixed because each value maps to a column on the
shared `integrationCredential` table (`accessKey`, `secretKey`, `baseUrl`). You
cannot invent new input names; reuse these three (or use `API_KEY` /`OAUTH`,
which store `apiKey` / `accessToken` + `refreshToken`).

## Folder layout

A complete integration (modeled on `src/integrations/gong/`):

```
src/integrations/<name>/
  config.ts             # exports the IntegrationConfig
  integration.ts        # exports the Integration (pipeline + lifecycle)
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

## Example Integration (`integration.ts`)

Gong (`src/integrations/gong/integration.ts`):

```ts
import type { Integration } from "@/core/models/models";
import { syncGongCallsStep } from "./sync-steps/sync-calls-step";
import { syncGongTranscriptsStep } from "./sync-steps/sync-transcripts-step";
import { parseGongStep } from "./sync-steps/parse-step";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { gongConfig } from "./config";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { deleteAllGongData } from "./db/queries";

export const syncGongPipeline = async (incremental: boolean = false) => {
  await Promise.all([
    syncGongCallsStep(incremental),
    syncGongTranscriptsStep(incremental),
  ]);                                   // parallel fetches
  await parseGongStep();                // raw rows → mdArtifact
  await indexVectorDbStep("Gong", incremental);  // shared embed + upsert
};

export const gongIntegration: Integration = {
  config: gongConfig,
  sync: async () => await syncGongPipeline(false),
  syncUpdates: async () => await syncGongPipeline(true),
  deleteSync: async () => {
    await deleteSyncTasksByIntegration("Gong");
    await deleteMdArtifactsByIntegration("Gong");
    await deleteEmbeddingByIntegration("Gong");
    await deleteAllGongData();          // your own raw tables
  },
};
```

Note the four delete calls in `deleteSync`: syncTasks, mdArtifacts, embeddings,
and the integration's own tables. The first three helpers are shared; the last
one you write in your `db/queries.ts`.

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

```ts
import { db } from "@/core/db/db";
import { sql } from "drizzle-orm";

export const batchInsertGongCall = async (calls: GongCallInsert[]): Promise<void> => {
  await db.insert(gongCall).values(calls).onConflictDoUpdate({
    target: gongCall.callId,
    set: { title: sql`excluded.title`, started: sql`excluded.started` /* ... */ },
  });
};

export const deleteAllGongData = async (): Promise<void> => {
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

// sync-registry.ts  (drives sync dispatch)
export const supportedIntegrations: Integration[] = [gongIntegration, /* ... */ myIntegration];
```

## How routes find your integration

`src/index.ts` matches the `:integration` path param against
`config.integration` case-insensitively — no per-integration route wiring:

```ts
const target = decodeURIComponent(req.params.integration).toLowerCase();
const index = supportedIntegrations.findIndex(
  (integ) => integ.config.integration.toLowerCase() === target);
supportedIntegrations[index]!.sync();   // fire-and-forget, NOT awaited
```

| Route | Method | Calls |
|---|---|---|
| `/api/sync/:integration` | POST | `sync()` |
| `/api/sync/updates/:integration` | POST | `syncUpdates()` |
| `/api/sync/:integration` | DELETE | `deleteSync()` |
| `/api/oauth/:integration` | GET | `handleRedirect(req)` |
