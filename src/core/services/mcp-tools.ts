import { z } from "zod";
import { embedTexts } from "@/core/services/embedding";
import {
  searchContentEmbeddingByCosine,
  searchKeyPointsEmbeddingByCosine,
  searchQuestionsAnsweredEmbeddingByCosine,
  type EmbeddingSearchFilters,
} from "@/core/db/queries/vector-queries";
import {
  getMdArtifactByIntegrationArtifactId,
  getMdArtifactsByIntegration,
  getIntegrationCredentials,
} from "@/core/db/queries/queries";
import type { MdArtifactSelect } from "@/core/db/schema/schema";
import type { McpTool, McpToolResult, MergedHit } from "@/core/models/mcp-models";
import { configRegistry } from "@/integrations/config-registry";

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const textResult = (text: string, isError = false): McpToolResult => ({
  content: [{ type: "text", text }],
  isError: isError || undefined,
});

const semanticSearchSchema = z.object({
  query: z.string().min(1).describe("Natural-language search query"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(25)
    .default(5)
    .describe("Maximum number of artifacts to return"),
  integration: z
    .string()
    .min(1)
    .optional()
    .describe("Only return artifacts from this integration (e.g. \"gong\")"),
  minDate: z
    .string()
    .optional()
    .describe("Only return artifacts on or after this ISO date (artifactDate >= minDate)"),
  maxDate: z
    .string()
    .optional()
    .describe("Only return artifacts on or before this ISO date (artifactDate <= maxDate)"),
  entities: z
    .array(z.string().min(1))
    .optional()
    .describe("Only return artifacts that include all of these entities (exact, case-sensitive match)"),
});

async function runSemanticSearch(args: unknown): Promise<McpToolResult> {
  const parsed = semanticSearchSchema.safeParse(args);
  if (!parsed.success) {
    return textResult(`Invalid arguments: ${parsed.error.message}`, true);
  }
  const { query, limit, integration, minDate, maxDate, entities } = parsed.data;

  const [embedding] = await embedTexts([query]);
  if (!embedding) {
    return textResult("Failed to embed the query.", true);
  }

  const filters: EmbeddingSearchFilters = { integration, minDate, maxDate, entities };

  const [content, keyPoints, questions] = await Promise.all([
    searchContentEmbeddingByCosine(embedding, limit, filters),
    searchKeyPointsEmbeddingByCosine(embedding, limit, filters),
    searchQuestionsAnsweredEmbeddingByCosine(embedding, limit, filters),
  ]);

  const merged = new Map<string, MergedHit>();
  const ingest = (
    rows: { integrationArtifactId: string; content: string | null; distance: number }[],
  ) => {
    for (const row of rows) {
      const existing = merged.get(row.integrationArtifactId);
      if (existing) {
        if (row.distance < existing.distance) {
          existing.distance = row.distance;
          existing.content = row.content;
        }
      } else {
        merged.set(row.integrationArtifactId, {
          integrationArtifactId: row.integrationArtifactId,
          distance: row.distance,
          content: row.content,
        });
      }
    }
  };
  ingest(content);
  ingest(keyPoints);
  ingest(questions);

  const hits = [...merged.values()]
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

  if (hits.length === 0) {
    return textResult(`No matches found for "${query}".`);
  }

  const artifacts = await Promise.all(
    hits.map((hit) => getArtifact(hit.integrationArtifactId)),
  );

  const blocks = hits.map((hit, i) => {
    const similarity = (1 - hit.distance).toFixed(3);
    const artifact = artifacts[i];
    const keyPointsList =
      artifact?.keyPoints && artifact.keyPoints.length > 0
        ? artifact.keyPoints.map((kp: string) => `  - ${kp}`).join("\n")
        : "  (none)";
    return [
      `### ${i + 1}. ${hit.integrationArtifactId}`,
      `- similarity: ${similarity}`,
      `- key points:`,
      keyPointsList,
    ].join("\n");
  });

  return textResult(
    `Found ${hits.length} matching artifact(s) for "${query}":\n\n${blocks.join("\n\n")}`,
  );
}


const getArtifactSchema = z.object({
  id: z
    .string()
    .min(1)
    .describe("The mdArtifacts primary id or the integrationArtifactId"),
});

async function getArtifact(id: string): Promise<MdArtifactSelect | undefined> {
  const artifact = await getMdArtifactByIntegrationArtifactId(id);
  return artifact;
}

async function runGetArtifact(args: unknown): Promise<McpToolResult> {
  const parsed = getArtifactSchema.safeParse(args);
  if (!parsed.success) {
    return textResult(`Invalid arguments: ${parsed.error.message}`, true);
  }

  const artifact = await getArtifact(parsed.data.id);
  if (!artifact) {
    return textResult(`No artifact found for id "${parsed.data.id}".`, true);
  }

  const fmtList = (label: string, items: string[] | null | undefined) =>
    `## ${label}\n${
      items && items.length > 0 ? items.map((x) => `- ${x}`).join("\n") : "(none)"
    }`;

  const text = [
    `# Artifact ID: ${artifact.integrationArtifactId}`,
    `- integration source: ${artifact.integration}`,
    `- artifactDate: ${artifact.artifactDate ?? "unknown"}`,
    fmtList("Key Points", artifact.keyPoints),
    fmtList("Questions Answered", artifact.questionsAnswered),
    fmtList("Entities", artifact.entities),
    `## Content\n${artifact.markdown ?? "(no markdown)"}`,
  ].join("\n\n");

  return textResult(text);
}

const getIntegrationSourcesSchema = z.object({});

async function runGetIntegrationSources(_args: unknown): Promise<McpToolResult> {
  if (configRegistry.length === 0) {
    return textResult("No integration sources are configured.");
  }

  const credentials = await getIntegrationCredentials();
  const connected = new Set(credentials.map((c) => c.integration));

  const blocks = configRegistry.map((cfg, i) => {
    const hasCredentials = connected.has(cfg.integration);
    return [
      `## ${i + 1}. ${cfg.integration}`,
      `- can sync: ${hasCredentials ? "yes\n" : "no (register credentials first)\n"}`,
    ].join("\n");
  });

  return textResult(
    `Supported integration sources (${configRegistry.length}):\n\n${blocks.join("\n\n")}`,
  );
}

const syncSourceSchema = z.object({
  integration: z
    .string()
    .min(1)
    .describe("The integration source to sync (e.g. \"gong\"). Use get_integration_sources to see valid names."),
});

async function runSyncSource(args: unknown): Promise<McpToolResult> {
  const parsed = syncSourceSchema.safeParse(args);
  if (!parsed.success) {
    return textResult(`Invalid arguments: ${parsed.error.message}`, true);
  }
  const { integration } = parsed.data;

  if (!configRegistry.some((cfg) => cfg.integration === integration)) {
    return textResult(
      `Unknown integration "${integration}". Use get_integration_sources to see valid names.`,
      true,
    );
  }

  const existing = await getMdArtifactsByIntegration(integration);
  const isIncremental = existing.length > 0;

  const baseUrl = process.env.BACKEND_BASE_URL;
  if (!baseUrl) {
    return textResult("BACKEND_BASE_URL is not configured.", true);
  }
  const path = isIncremental
    ? `/api/sync/updates/${encodeURIComponent(integration)}`
    : `/api/sync/${encodeURIComponent(integration)}`;

  const res = await fetch(`${baseUrl}${path}`, { method: "POST" });
  if (!res.ok) {
    return textResult(
      `Failed to start ${isIncremental ? "incremental" : "full"} sync for "${integration}" (HTTP ${res.status}).`,
      true,
    );
  }

  return textResult(
    isIncremental
      ? `Started an incremental sync for "${integration}" (${existing.length} existing artifact(s) found). New and updated artifacts will be ingested in the background.`
      : `Started a full sync for "${integration}" (no existing artifacts). Artifacts will be ingested in the background.`,
  );
}

export const tools: McpTool[] = [
  {
    name: "semantic_search",
    description:
      "Semantic search across indexed call content, extracted key points, and questions answered. Returns the most relevant artifacts with their key points. Optionally filter by integration, date range (minDate/maxDate against artifactDate), and entities included. Use the returned integrationArtifactId with get_md_artifact_by_id to read the full summary.",
    annotations: { title: "Semantic search", ...READ_ONLY },
    inputSchema: semanticSearchSchema,
    handler: runSemanticSearch,
  },
  {
    name: "get_md_artifact_by_id",
    description:
      "Fetch the full markdown summary and metadata for a single mdArtifact by its id.",
    annotations: { title: "Get artifact by id", ...READ_ONLY },
    inputSchema: getArtifactSchema,
    handler: runGetArtifact,
  },
  {
    name: "get_integration_sources",
    description:
      "List the integration sources supported by this server, and for each whether credentials are configured and a sync can begin. Use the returned integration name as the `integration` filter in semantic_search.",
    annotations: { title: "Get integration sources", ...READ_ONLY },
    inputSchema: getIntegrationSourcesSchema,
    handler: runGetIntegrationSources,
  },
  {
    name: "sync_source",
    description:
      "Trigger a sync for an integration source. Runs a full sync if no artifacts have been ingested yet, otherwise an incremental sync that picks up new and updated artifacts. The sync runs in the background.",
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
