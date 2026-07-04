# The sync pipeline

```
sync-data (parallel fetches) → parse (LLM-extracted insights) → index-vector (embed + upsert)
```

Each step writes `syncTask` rows so the web UI can show progress. Syncs are
fire-and-forget, so a step must never throw to the caller — catch, log a FAILED
`syncTask`, and continue.

Every step and query takes the shared `db: SqliteDb` handle as a parameter (it
is threaded down from the route — see `anatomy.md`). Never import `db` directly;
accept it and pass it through.

## Shared building blocks

| Helper | Location | Use |
|---|---|---|
| `retry(fn, maxAttempt=3, attempt=1)` | `src/lib/utils.ts` | wrap every network/LLM call; quadratic backoff |
| `aiGatewayBottleneck` | `src/core/services/rate-limiter.ts` | throttle **all** AI Gateway calls (`maxConcurrent: 5`, `minTime: 200`) |
| `embedTexts(strings)` | `src/core/services/embedding.ts` | embeddings (`openai/text-embedding-3-small`) |
| `SUMMARIZATION_MODEL` | `src/lib/constants.ts` | `google/gemini-3-flash` for parsing |
| `PAGE_SIZE` | `src/lib/constants.ts` | `20` — standard pagination window |
| `upsertSyncTask(task, db)` | `src/core/db/queries/queries.ts` | record step status |
| `upsertMdArtifact(artifact, db)` | `src/core/db/queries/queries.ts` | write the parse output |
| `indexVectorDbStep(integration, incremental, db)` | `src/core/services/index-vector-db-step.ts` | the entire vector step — **reuse, don't rewrite** |

## Step 1 — sync-data

Fetch from the source and batch-insert into your raw tables. Read credentials,
paginate, wrap fetches in `retry()`, and log a `syncTask` each page.

### Optional cursor (required for paginated steps)

Every paginated sync-data step **must** accept an optional `cursor` as the last
parameter (after `db`). When omitted, start from the beginning; when provided,
resume from that position. Persist the cursor in each page's `syncTask.inputs` so
a failed sync can be retried — on SUCCESS write the *next* cursor, on FAILED
write the cursor you were on when the error happened.

Signature convention: `(incremental, db, cursor?)`. Use a plain `string` when
pagination is a single API cursor; use a typed object when you need to resume
multi-dimensional work (e.g. `{ repo, url }` for GitHub, `{ channelId, cursor }`
for Discord/Slack).

Condensed from `src/integrations/notion/sync-steps/sync-notion-pages.ts`:

```ts
import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import type { SqliteDb } from "@/core/models/db-models";

export const syncNotionPages = async (incremental: boolean = false, db: SqliteDb, cursor?: string) => {
  let nextCursor: string | undefined = cursor;

  while (true) {
    let response: NotionSearchResponse | null = null;
    try {
      response = await retry(async () => getPages(db, nextCursor), 3, 1);
    } catch (e) {
      await upsertSyncTask({
        integration: "notion", status: "FAILED", step: "notion-sync-pages",
        inputs: { cursor: nextCursor, error: e },
      }, db);
      break;
    }
    try {
      await upsertPages(response.results, db);
      if (!response.has_more || !response.next_cursor) break;
      nextCursor = response.next_cursor;
      await upsertSyncTask({
        integration: "notion", status: "SUCCESS", step: "notion-sync-pages",
        inputs: { cursor: nextCursor },
      }, db);
    } catch (e) {
      await upsertSyncTask({
        integration: "notion", status: "FAILED", step: "notion-sync-pages",
        inputs: { cursor: nextCursor, error: e },
      }, db);
      if (!response.next_cursor) break;
    }
  }
};
```

Gong uses the same optional-cursor signature with a simpler loop — condensed
from `src/integrations/gong/sync-steps/sync-calls-step.ts`:

```ts
import { getIntegrationCredentialByIntegration, upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { batchInsertGongCall, getLatestGongCall } from "../db/queries";
import type { SqliteDb } from "@/core/models/db-models";

export const syncGongCallsStep = async (incremental: boolean = false, db: SqliteDb, cursor?: string) => {
  // incremental: only fetch items newer than what we already have
  let latestDate: string | null = null;
  if (incremental) {
    const latestCall = await getLatestGongCall(db);
    if (latestCall) latestDate = latestCall.started;
  }

  const { basicToken, baseUrl } = await getCredentials(db);

  let curCursor: string | null = cursor ?? null;
  let first = true;
  while ((curCursor || first) && baseUrl) {
    first = false;
    curCursor = await fetchPage(db, basicToken, baseUrl, curCursor, latestDate);  // returns next cursor
    if (cursor) break;   // when resuming with a passed-in cursor, fetch one page only
  }
};

const fetchPage = async (db, token, baseUrl, cursor, startDate): Promise<string | null> => {
  try {
    const url = new URL(`${baseUrl}/v2/calls`);
    if (cursor) url.searchParams.append("cursor", cursor);
    if (startDate) url.searchParams.append("fromDateTime", startDate);

    const res = await retry(async () => await fetch(url, {
      method: "GET",
      headers: { Authorization: `Basic ${token}`, "Content-Type": "application/json" },
    }));
    const body = await res.json();

    await batchInsertGongCall(body.calls.map(c => ({ callId: c.id, title: c.title, started: c.started /* ... */ })), db);

    await upsertSyncTask({ integration: "Gong", status: "SUCCESS", inputs: JSON.stringify({ cursor }), step: "gong-sync-call" }, db);
    return body.records.cursor;       // null when done
  } catch (e) {
    await upsertSyncTask({ integration: "Gong", status: "FAILED", inputs: JSON.stringify({ cursor, error: e }), step: "gong-sync-call" }, db);
    return null;
  }
};
```

Reading credentials (`getCredentials(db)` in the same file) — `BASIC_TOKEN`
builds a base64 token from `accessKey:secretKey`:

```ts
const cred = await getIntegrationCredentialByIntegration("Gong", db);
const basicToken = btoa(cred?.accessKey + ":" + cred?.secretKey);
```

Independent fetches run in parallel from the pipeline via `Promise.all([...])`
(see Gong: calls + transcripts).

## Step 2 — parse

Read raw rows, render markdown, run the summarization LLM to extract structured
insight, and `upsertMdArtifact`. **Every LLM call goes through the bottleneck.**
Condensed from `src/integrations/gong/sync-steps/parse-step.ts`:

```ts
import { getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { PAGE_SIZE, SUMMARIZATION_MODEL } from "@/lib/constants";
import { generateText, Output } from "ai";
import * as z from "zod";
import { aiGatewayBottleneck } from "@/core/services/rate-limiter";
import type { SqliteDb } from "@/core/models/db-models";

export const parseGongStep = async (db: SqliteDb) => {
  let offset = 0;
  let rows = [];
  let first = true;
  while (rows.length > 0 || first) {
    first = false;
    rows = await getGongTranscripts(offset, db);
    // schedule each LLM job through the shared limiter; settle all
    const results = await Promise.allSettled(
      rows.map((t) => aiGatewayBottleneck.schedule(() => generateMdArtifact(t, db)))
    );
    const failures = results.filter(r => r.status === "rejected").map(r => String(r.reason));
    await upsertSyncTask({
      integration: "Gong",
      status: failures.length ? "FAILED" : "SUCCESS",
      inputs: JSON.stringify(failures.length ? { offset, errors: failures } : { offset }),
      step: "parse",
    }, db);
    offset += PAGE_SIZE;
  }
};

const generateMdArtifact = async (row, db: SqliteDb): Promise<void> => {
  const markdown = renderMarkdown(row);   // build the markdown string from raw data

  // idempotency: skip re-summarizing unchanged artifacts
  const existing = await getMdArtifactByIntegrationArtifactId(row.callId, db);
  if (existing && existing.markdown === markdown) return;

  const { output: analysis } = await retry(async () => await generateText({
    model: SUMMARIZATION_MODEL,
    prompt: `Analyze the following and extract:
1. KEY POINTS  2. QUESTIONS ANSWERED  3. ENTITIES

${markdown}`,
    output: Output.object({
      schema: z.object({
        keyPoints: z.array(z.string()),
        questionsAnswered: z.array(z.string()),
        entities: z.array(z.string()),
      }),
    }),
  }), 3, 1);

  await upsertMdArtifact({
    integrationArtifactId: row.callId,   // stable, unique per artifact
    integration: "Gong",                 // must match config.integration
    artifactDate: row.started,
    markdown,
    keyPoints: analysis.keyPoints,
    questionsAnswered: analysis.questionsAnswered,
    entities: analysis.entities,
  }, db);
};
```

### The `mdArtifact` contract

This is the only output the vector step reads. Shape
(`src/core/db/schema/schema.ts`):

| Field | Notes |
|---|---|
| `integrationArtifactId` | **unique, stable** per artifact — re-syncs upsert on it |
| `integration` | must equal `config.integration` |
| `artifactDate` | source timestamp; powers date-range search filters |
| `markdown` | rendered body; chunked + embedded as `content` |
| `keyPoints` | `string[]`; embedded into `keyPointsEmbedding` |
| `questionsAnswered` | `string[]`; embedded into `questionsAnsweredEmbedding` |
| `entities` | `string[]`; copied onto every embedding row for filtering |

## Step 3 — index-vector (shared, do not rewrite)

Call the shared step from your pipeline:

```ts
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
await indexVectorDbStep("Gong", incremental, db);
```

`indexVectorDbStep` (`src/core/services/index-vector-db-step.ts`) pages through
`mdArtifacts` for that integration and, per artifact: chunks markdown (~250
words/chunk), embeds content + key points + questions via `embedTexts` (each
scheduled through `aiGatewayBottleneck` and wrapped in `retry`), and upserts
`contentEmbedding` / `keyPointsEmbedding` / `questionsAnsweredEmbedding`. When
`incremental` is `false` it skips artifacts that already have embeddings. It
writes its own `index-vector` syncTask rows. You pass the integration string,
the flag, and `db` — nothing else.

## Rate limiting & retries — the rules

- **Never** fire AI Gateway calls (embeddings or LLM parsing) concurrently
  without the limiter. Always `aiGatewayBottleneck.schedule(() => ...)`.
- Wrap each network/LLM call in `retry()` — it retries 3× with quadratic
  backoff and re-throws on exhaustion.
- Combine them as `aiGatewayBottleneck.schedule(() => retry(() => llmCall()))`.
- Use `Promise.allSettled` for a page of independent LLM jobs so one failure
  doesn't drop the others; summarize failures into the `syncTask`.
