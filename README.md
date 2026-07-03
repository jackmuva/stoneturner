# <img src="src/assets/stoneturner.png" alt="stoneturner" width="30" style="vertical-align:middle" /> Stoneturner

The unifying data sync & search layer for agents.

Stoneturner syncs data from external integrations, converts it into structured markdown, vectorizes it, and exposes it to agents via an MCP server. Agents can search across all your integrated context semantically, retrieve raw artifacts, and trigger syncs — all through standard MCP tool calls.

It also ships with a web UI for monitoring sync tasks, viewing raw markdown artifacts, and configuring integration credentials.

## How it works

1. **Connect an integration** — provide API credentials via the web UI or API (Gong, Discord, Notion, Plaud, Firecrawl, GitHub, and more)
2. **Sync** — stoneturner fetches data, parses it into markdown artifacts, and indexes them into vector tables
3. **Search** — agents query the MCP server using `semantic_search` and other tools to find relevant context

The sync pipeline for each integration follows this pattern:

```
sync-data (parallel fetches) → parse (LLM-extracted insights) → index-vector (embed + upsert)
```

All network and LLM calls are wrapped in retry logic with quadratic backoff. Syncs are fire-and-forget from the HTTP handler.

## MCP tools

The MCP server (Streamable HTTP at `/mcp`) exposes six tools:

| Tool | Description |
|---|---|
| `semantic_search` | Semantic search across indexed content, key points, and questions answered. Supports filtering by integration, date range, and entities. |
| `get_md_artifact_by_id` | Retrieve a single markdown artifact by ID — full content, key points, questions, entities, and metadata. |
| `showUserArtifact` | Get a shareable URL to open a single artifact in the Stoneturner web UI (`/knowledge/artifact/:id`). Use when the user wants to view an artifact; use `get_md_artifact_by_id` when you need its content. |
| `run_sql_query` | Run a single read-only `SELECT` statement against the underlying SQLite (libSQL/Turso) database. Returns rows as JSON. Only `SELECT` (and `WITH ... SELECT`) statements are permitted — any mutating or schema-modifying statement is rejected. |
| `get_integration_sources` | List all registered integrations and their credential status. |
| `sync_source` | Trigger a full or incremental sync for an integration. Returns a credential URL if not yet configured. |

## Getting started

### Prerequisites

- [Bun](https://bun.com) v1.3+
- An [Vercel AI Gateway API key](https://vercel.com/ai-gateway) (for embeddings)

### Install

```bash
git clone https://github.com/jackmuva/stoneturner.git
cd stoneturner
bun install
```

### Configure environment

```bash
cp .env.example .env
```

Set these variables in `.env`:

| Variable | Required | Description |
|---|---|---|
| `BUN_PUBLIC_BACKEND_BASE_URL` | Yes | Backend URL, inlined at build time (e.g. `http://localhost:9000`) |
| `FRONTEND_BASE_URL` | Yes | Frontend URL, used for CORS (e.g. `http://localhost:9000`) |
| `AI_GATEWAY_API_KEY` | Yes | API key if using an AI gateway |
| `BUN_PUBLIC_DEV_MODE` | No | Set to `true` to create a test database for developing new integrations (default: `false`) |

### Database setup

Generate and apply migrations:

```bash
bun run generate
bun run migrate
```

This creates a local `stoneturner.db` Turso/libSQL file. No remote database URL is needed for local development.

### Run the dev server

```bash
bun dev
```

Starts the server with hot reload on port 9000.

### Build for production

```bash
bun run build
bun start
```

## Project structure

```
src/
  core/
    db/              # Database connection, queries, and schemas (relational + vector)
    handlers/        # HTTP + MCP request handlers
    middleware/      # CORS middleware (note: directory is "middlware")
    models/          # Shared type definitions
    services/        # Embedding, vector indexing, MCP server, tools
  integrations/
    config-registry.ts   # Frontend UI config for all integrations
    sync-registry.ts     # Sync dispatch for all integrations
    gong/                 # Gong integration
      config.ts           # IntegrationConfig definition
      integration.ts      # Integration object (sync pipeline, delete)
      db/                 # Gong-specific schemas and queries
      models/             # Gong API response types
      sync-steps/         # Individual sync pipeline steps
  client/               # React SPA (monitoring + credential config)
  index.ts              # Bun.serve() entry point with all routes
```

## Adding an integration

### Try the Stoneturner Skill for adding new integrations

```bash
npx skills add jackmuva/stoneturner
```

Look at `/integration-specs` to see examples of specs that give an agent complete context to implementing a new integration with the Stoneturner Skill

Stoneturner is designed to make adding integrations straightforward. Each integration lives in its own directory under `src/integrations/`.

### 1. Create the integration directory

```
src/integrations/my-integration/
  config.ts
  integration.ts
  db/
    schema.ts
    queries.ts
  models/
    models.ts
  sync-steps/
    sync-data-step.ts
    parse-step.ts
```

### 2. Define `IntegrationConfig`

In `config.ts`, export a config that describes how users authenticate:

```ts
import type { IntegrationConfig } from "@/core/models/models";

export const myConfig: IntegrationConfig = {
  integration: "MyIntegration",
  icon: "/assets/my-integration.png",
  integrationType: "API_KEY",        // "BASIC_TOKEN" | "OAUTH" | "API_KEY"
  description: "My integration description",
  inputs: [
    { input: "accessKey", label: "Access Key" },
    { input: "secretKey", label: "Secret Key" },
    { input: "baseUrl", label: "API Base URL" },
  ],//optional
  installUrl: "https://app.my-integration.com/install",//optional
  oauthAuthorizationUrl: "https://app.my-integration.com/oauth/authorize", //optional, but necessary for OAuth
};
```

### 3. Define `Integration`

In `integration.ts`, export an `Integration` object with your sync pipeline:

```ts
import type { Integration } from "@/core/models/models";
import { myConfig } from "./config";

export const myIntegration: Integration = {
  config: myConfig,
  sync: async () => { /* full sync */ },
  syncUpdates: async () => { /* incremental sync */ },
  deleteSync: async () => { /* clean up all data */ },
  handleRedirect: async (req) => { /* handle OAuth redirect */ },
  refreshAccessTokens: async () => { /* refresh OAuth tokens */ },
};
```

### 5. Define database schemas and migrate

Add your integration's tables in `src/integrations/my-integration/db/schema.ts`. 

Point drizzle to your new schemas in `drizzle.config.ts`.

```typescript
export default defineConfig({
  schema: [
    './src/core/db/schema/*',
    './src/integrations/gong/db/schema.ts',
    './src/integrations/discord/db/schema.ts',
    './src/integrations/notion/db/schema.ts',
    //...
  ],
  //...
}
```

Then generate and apply migrations:

```bash
bun run generate
bun run migrate
```

This updates the local `stoneturner.db`. In dev mode (`BUN_PUBLIC_DEV_MODE=true`), a separate test database is created so you can iterate without affecting production data.

### 6. Register the integration

Add your config to `src/integrations/config-registry.ts`:

```ts
import { myConfig } from "./my-integration/config";

export const configRegistry: IntegrationConfig[] = [
  gongConfig,
  myConfig,    // add yours
];
```

Add your integration to `src/integrations/sync-registry.ts`:

```ts
import { myIntegration } from "./my-integration/integration";

export const supportedIntegrations: Integration[] = [
  gongIntegration,
  myIntegration,    // add yours
];
```

## License

Apache 2.0
