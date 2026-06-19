import { READ_ONLY, type McpTool } from "../models/mcp-models";
import { getArtifactSchema, runGetArtifact, runSemanticSearch, semanticSearchSchema } from "./tools/search-tools";
import { getIntegrationSourcesSchema, runGetIntegrationSources, runSyncSource, syncSourceSchema } from "./tools/sync-tools";

export const tools: McpTool[] = [
  {
    name: "semantic_search",
    description:
      "Semantic search across indexed call content, extracted key points, and questions answered. Returns the most relevant artifacts ranked by similarity, each with its key points. Optionally filter by integration, date range (minDate/maxDate against artifactDate), and entities included. Use the returned integrationArtifactId with get_md_artifact_by_id to read the full summary.\n\n" +
      "When to use: this is the primary entry point for finding relevant calls/recordings. Reach for it whenever you need to locate content by meaning rather than by a known id — answering a question about what was discussed, finding calls that mention a topic, gathering context before drilling into a specific artifact. If you already have an artifact id, skip this and call get_md_artifact_by_id directly.\n\n" +
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
      "When to use: after semantic_search returns a promising hit and you need the complete content — not just the key points — to answer a question or quote details. Also use it directly when the user references a specific artifact id. It does not search; if you don't already have an id, run semantic_search first.\n\n" +
      "Examples:\n" +
      "- Look up an artifact the user named: { \"id\": \"a1b2c3d4-...\" }",
    annotations: { title: "Get artifact by id", ...READ_ONLY },
    inputSchema: getArtifactSchema,
    handler: runGetArtifact,
  },
  {
    name: "get_integration_sources",
    description:
      "List the integration sources supported by this server, and for each whether credentials are configured so a sync can begin. Takes no arguments.\n\n" +
      "When to use: to discover valid integration names before filtering a semantic_search by `integration` or before calling sync_source, and to check whether a source is ready to sync (credentials registered) or still needs setup. Useful as a first step when you don't yet know which sources exist.\n\n" +
      "If a source shows it cannot sync yet, its credentials are not registered. To register them, call sync_source for that integration — it will return a URL where the user can input their credentials. Direct the user to that URL, and once they confirm they've connected, call get_integration_sources again to verify the source is ready before syncing.\n\n" +
      "Example:\n" +
      "- List everything available: {}",
    annotations: { title: "Get integration sources", ...READ_ONLY },
    inputSchema: getIntegrationSourcesSchema,
    handler: runGetIntegrationSources,
  },
  {
    name: "sync_source",
    description:
      "Trigger a sync for an integration source, and the tool to use to register a user's credentials for a source. Automatically runs a full sync if no artifacts have been ingested yet, otherwise an incremental sync that picks up new and updated artifacts since the last sync. The sync runs in the background and returns immediately — newly ingested content will not be searchable until it finishes.\n\n" +
      "Registering credentials: if the source's credentials are not yet registered, this tool does NOT sync — instead it returns a URL where the user can input their credentials. When that happens, open the URL using bash tools (if unable, share the URL directly). Once they confirm they've connected, you can verify with get_integration_sources and then call sync_source again to begin the sync. This is the path to use whenever a user needs to connect or register a new source.\n\n" +
      "When to use: to register a user's credentials for a source (it returns the connection URL when they aren't set up yet), or when the indexed data may be stale or incomplete and you want to pull in the latest artifacts before searching — e.g. the user asks about a recent call that semantic_search can't find, or explicitly asks to refresh/import a source. You can check connection status first with get_integration_sources. This is the only non-read-only tool here; don't call it just to browse.\n\n" +
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
