import { READ_ONLY, type McpTool } from "../models/mcp-models";
import { getArtifactSchema, runGetArtifact, runSemanticSearch, runShowUserArtifact, runSqlQuery, runSqlQuerySchema, semanticSearchSchema, showUserArtifactSchema } from "./tools/search-tools";
import { getDataSourceContextSchema, getIntegrationSourcesSchema, runGetDataSourceContext, runGetIntegrationSources, runSyncSource, syncSourceSchema } from "./tools/sync-tools";

export const tools: McpTool[] = [
  {
    name: "get_integrated_data_sources",
    description:
      `List the data sources supported by this server, and for each whether credentials are configured and whether a context overview document exists. Takes no arguments.\n\n
      Recommended workflow when a user first asks about a data source: (1) call get_integrated_data_sources to discover sources and connection status, or get_data_source_context to load the auto-generated lay-of-the-land overview for a specific source; (2) once you understand the source, use semantic_search, get_md_artifact_by_id, or run_sql_query to find and read actual content.\n\n
      When to use: as a first step when a user asks about a data source and you need to discover which sources exist, whether they are connected, and whether context is available. Follow up with get_data_source_context for the lay-of-the-land overview of a specific source before searching.\n\n" +
      "If a source shows it cannot sync yet, its credentials are not registered. To register them, call sync_source for that integration — it will return a URL where the user can input their credentials. Direct the user to that URL, and once they confirm they've connected, call get_integrated_data_sources again to verify the source is ready before syncing.\n\n` +
      "Example:\n" +
      "- List everything available: {}",
    annotations: { title: "Get integrated data sources", ...READ_ONLY },
    inputSchema: getIntegrationSourcesSchema,
    handler: runGetIntegrationSources,
  },
  {
    name: "get_data_source_context",
    description:
      "Fetch the auto-generated lay-of-the-land overview for one or all integrated data sources. Each overview summarizes common themes, entities, and patterns in that source's data — written to help agents orient before searching.\n\n" +
      "When to use: when a user first asks about a specific data source (e.g. \"what's in my Gong calls?\", \"search my GitHub issues\"), call this for that integration before semantic_search, get_md_artifact_by_id, or run_sql_query. If you don't yet know which sources exist, call get_integrated_data_sources first. Context is generated automatically after a sync completes; if none exists yet, sync_source may be needed.\n\n" +
      "Examples:\n" +
      "- Overview for one source: { \"integration\": \"gong\" }",
    annotations: { title: "Get data source context", ...READ_ONLY },
    inputSchema: getDataSourceContextSchema,
    handler: runGetDataSourceContext,
  },
  {
    name: "semantic_search",
    description:
      "Semantic search across indexed call content, extracted key points, and questions answered. Returns the most relevant artifacts ranked by similarity, each with its key points. Optionally filter by integration, date range (minDate/maxDate against artifactDate), and entities included. Use the returned integrationArtifactId with get_md_artifact_by_id to read the full summary.\n\n" +
      "When to use: after orienting with get_data_source_context (or get_integrated_data_sources), use this as the primary way to find content by meaning — answering questions about what was discussed, finding artifacts that mention a topic, gathering candidates before drilling into a specific artifact. If you already have an artifact id, skip this and call get_md_artifact_by_id directly.\n\n" +
      "Examples:\n" +
      "- Find discussions of a topic: { \"query\": \"pricing objections from enterprise prospects\" }\n" +
      "- Narrow to one source and recent dates: { \"query\": \"onboarding pain points\", \"integration\": \"gong\", \"minDate\": \"2026-01-01\" }\n" +
      "- Require specific entities and cast a wider net: { \"query\": \"renewal risk\", \"entities\": [\"Acme Corp\"], \"limit\": 15 }",
    annotations: { title: "Semantic search", ...READ_ONLY },
    inputSchema: semanticSearchSchema,
    handler: runSemanticSearch,
  },
  {
    name: "get_md_artifact_by_id",
    description:
      "Fetch the full markdown summary and metadata (integration source, artifactDate, key points, questions answered, entities, and full markdown content) for a single mdArtifact.\n\n" +
      "When to use: after semantic_search returns a promising hit and you need the complete content — not just the key points — to answer a question or quote details. Also use directly when the user references a specific artifact id. If exploring a data source for the first time, call get_data_source_context for that integration before searching. It does not search; if you don't already have an id, run semantic_search first.\n\n" +
      "Examples:\n" +
      "- Look up an artifact the user named: { \"id\": \"a1b2c3d4-...\" }",
    annotations: { title: "Get artifact by id", ...READ_ONLY },
    inputSchema: getArtifactSchema,
    handler: runGetArtifact,
  },
  {
    name: "showUserArtifact",
    description:
      "Get a shareable URL to show the user a single artifact rendered in the Stoneturner web app, and a prompt to open it for them. Returns a link to the /knowledge/artifact/:artifactId page.\n\n" +
      "When to use: whenever the user wants to *see* / open / view an artifact (as opposed to you reading its content to answer a question). Accepts the integrationArtifactId returned by semantic_search. After calling it, open the returned URL for the user with your available tools if you can; otherwise share the URL directly.\n\n" +
      "Examples:\n" +
      "- Show an artifact the user asked to see: { \"id\": \"a1b2c3d4-...\" }",
    annotations: { title: "Show user artifact", ...READ_ONLY },
    inputSchema: showUserArtifactSchema,
    handler: runShowUserArtifact,
  },
  {
    name: "run_sql_query",
    description:
      "Run a single read-only SQL SELECT statement against the underlying database and return the result rows as JSON. The database is SQLite (libSQL/Turso), so use SQLite syntax and functions (e.g. json_extract, strftime, GROUP_CONCAT). Only SELECT (and WITH ... SELECT) statements are permitted — any statement that mutates data or schema (INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, PRAGMA, ATTACH, etc.) or stacks multiple statements is rejected.\n\n" +
      "When to use: after orienting with get_data_source_context, for precise structured lookups and aggregations that semantic_search can't express — counting artifacts, filtering by exact column values, joining tables, or inspecting raw integration tables. Reach for semantic_search instead when you need to find content by meaning.\n\n" +
      "Discovering the schema: since this is SQLite, list all tables by querying the `sqlite_master` catalog. Key tables: `mdArtifacts` (integrationArtifactId, integration, artifactDate, keyPoints, questionsAnswered, entities, markdown), `sourceContext` (integration, context, updateDate), `integrationCredential`, `syncTask`.\n\n" +
      "Examples:\n" +
      "- List all tables: { \"query\": \"SELECT name FROM sqlite_master WHERE type='table'\" }\n" +
      "- Inspect a table's columns/DDL: { \"query\": \"SELECT sql FROM sqlite_master WHERE type='table' AND name='mdArtifacts'\" }\n" +
      "- Count artifacts per integration: { \"query\": \"SELECT integration, COUNT(*) AS n FROM mdArtifacts GROUP BY integration\" }\n" +
      "- Most recent calls: { \"query\": \"SELECT integrationArtifactId, artifactDate FROM mdArtifacts ORDER BY artifactDate DESC\", \"maxRows\": 10 }",
    annotations: { title: "Run SQL query", ...READ_ONLY },
    inputSchema: runSqlQuerySchema,
    handler: runSqlQuery,
  },
  {
    name: "sync_source",
    description:
      "Trigger a sync for an integrated data source, and the tool to use to register a user's credentials for a source. Automatically runs a full sync if no artifacts have been ingested yet, otherwise an incremental sync that picks up new and updated artifacts since the last sync. The sync runs in the background and returns immediately — newly ingested content will not be searchable until it finishes. A lay-of-the-land context document is generated automatically when the sync pipeline completes.\n\n" +
      "Registering credentials: if the source's credentials are not yet registered, this tool does NOT sync — instead it returns a URL where the user can input their credentials. When that happens, open the URL using bash tools (if unable, share the URL directly). Once they confirm they've connected, you can verify with get_integrated_data_sources and then call sync_source again to begin the sync. This is the path to use whenever a user needs to connect or register a new source.\n\n" +
      "When to use: to register a user's credentials for a source (it returns the connection URL when they aren't set up yet), or when the indexed data may be stale or incomplete and you want to pull in the latest artifacts before searching — e.g. the user asks about a recent call that semantic_search can't find, or explicitly asks to refresh/import a source. Check connection status first with get_integrated_data_sources. After sync completes, call get_data_source_context to load the source overview before searching. This is the only non-read-only tool here; don't call it just to browse.\n\n" +
      "Examples:\n" +
      "- Register credentials or refresh a source (returns a connection URL if not yet connected, otherwise syncs): { \"integration\": \"gong\" }",
    annotations: {
      title: "Sync source",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: syncSourceSchema,
    handler: runSyncSource,
  },
];

export const toolsByName = new Map(tools.map((t) => [t.name, t]));
