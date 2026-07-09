import { z } from "zod";
import { sql } from "drizzle-orm";
import { embedTexts } from "@/core/services/embedding";
import {
  searchContentEmbeddingByCosine,
  searchKeyPointsEmbeddingByCosine,
  searchQuestionsAnsweredEmbeddingByCosine,
  type EmbeddingSearchFilters,
} from "@/core/db/queries/vector-queries";
import {
  getMdArtifactById,
  getMdArtifactByIntegrationArtifactId,
} from "@/core/db/queries/queries";
import type { MdArtifactSelect } from "@/core/db/schema/schema";
import type { McpToolResult, MergedHit } from "@/core/models/mcp-models";
import { textResult } from "@/lib/utils";
import type { SqliteDb } from "@/core/models/db-models";

export const semanticSearchSchema = z.object({
  query: z.string().min(1).describe("Natural-language search query"),
  limit: z.number().int().min(1).max(25).default(5).describe("Maximum number of artifacts to return"),
  integration: z.string().min(1).optional().describe("Only return artifacts from this integration (e.g. \"gong\")"),
  minDate: z.string().optional().describe("Only return artifacts on or after this ISO date (artifactDate >= minDate)"),
  maxDate: z.string().optional().describe("Only return artifacts on or before this ISO date (artifactDate <= maxDate)"),
  entities: z.array(z.string().min(1)).optional().describe("Only return artifacts that include all of these entities (exact, case-sensitive match)"),
});

export async function runSemanticSearch(args: unknown, db: SqliteDb): Promise<McpToolResult> {
  const parsed = semanticSearchSchema.safeParse(args);
  if (!parsed.success) return textResult(`Invalid arguments: ${parsed.error.message}`, true);

  const { query, limit, integration, minDate, maxDate, entities } = parsed.data;

  const [embedding] = await embedTexts([query]);
  if (!embedding) return textResult("Failed to embed the query.", true);

  const filters: EmbeddingSearchFilters = { integration, minDate, maxDate, entities };

  const [content, keyPoints, questions] = await Promise.all([
    searchContentEmbeddingByCosine(embedding, limit, filters, db),
    searchKeyPointsEmbeddingByCosine(embedding, limit, filters, db),
    searchQuestionsAnsweredEmbeddingByCosine(embedding, limit, filters, db),
  ]);

  let merged = new Map<string, MergedHit>();
  merged = ingest(merged, content);
  merged = ingest(merged, keyPoints);
  merged = ingest(merged, questions);

  const hits = [...merged.values()].sort((a, b) => a.distance - b.distance).slice(0, limit);

  if (hits.length === 0) return textResult(`No matches found for "${query}".`);

  const artifacts = await Promise.all(
    hits.map((hit) => getArtifact(hit.integrationArtifactId, db)),
  );

  const blocks = hits.map((hit, i) => {
    const similarity = (1 - hit.distance).toFixed(3);
    const artifact = artifacts[i];
    const keyPointsList = artifact?.keyPoints && artifact.keyPoints.length > 0
      ? artifact.keyPoints.map((kp: string) => `  - ${kp}`).join("\n")
      : "  (none)";
    return [
      `### ${i + 1}. ${hit.integrationArtifactId}`,
      `- similarity: ${similarity}`,
      `- key points:`,
      keyPointsList,
    ].join("\n");
  });

  return textResult(`Found ${hits.length} matching artifact(s) for "${query}":\n\n${blocks.join("\n\n")}`);
}


export const getArtifactSchema = z.object({
  id: z.string().min(1).describe("The mdArtifacts primary id or the integrationArtifactId"),
});

export async function getArtifact(id: string, db: SqliteDb): Promise<MdArtifactSelect | undefined> {
  const [byPrimaryId] = await getMdArtifactById(id, db);
  if (byPrimaryId) return byPrimaryId;
  const byIntegrationId = await getMdArtifactByIntegrationArtifactId(id, db);
  return byIntegrationId ?? undefined;
}

export async function runGetArtifact(args: unknown, db: SqliteDb): Promise<McpToolResult> {
  const parsed = getArtifactSchema.safeParse(args);
  if (!parsed.success) return textResult(`Invalid arguments: ${parsed.error.message}`, true);

  const artifact = await getArtifact(parsed.data.id, db);
  if (!artifact) return textResult(`No artifact found for id "${parsed.data.id}".`, true);

  const fmtList = (label: string, items: string[] | null | undefined) =>
    `## ${label}\n${items && items.length > 0 ? items.map((x) => `- ${x}`).join("\n") : "(none)"
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

export const showUserArtifactSchema = z.object({
  id: z.string().min(1).describe("The mdArtifacts primary id or the integrationArtifactId of the artifact to show the user"),
});

export async function runShowUserArtifact(args: unknown, db: SqliteDb): Promise<McpToolResult> {
  const parsed = showUserArtifactSchema.safeParse(args);
  if (!parsed.success) return textResult(`Invalid arguments: ${parsed.error.message}`, true);

  const { id } = parsed.data;

  const [byPrimaryId] = await getMdArtifactById(id, db);
  const artifact = byPrimaryId ?? (await getMdArtifactByIntegrationArtifactId(id, db));
  if (!artifact) return textResult(`No artifact found for id "${id}".`, true);

  const url = `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/knowledge/artifact/${artifact.id}`;

  return textResult(
    `Open this URL to show the user the artifact: ${url}\n\n` +
    `Open it for them using your available tools (e.g. a browser/open command); if you can't, share the URL directly so they can open it themselves.`,
  );
}

export const runSqlQuerySchema = z.object({
  query: z.string().min(1).describe("A single read-only SQLite (libSQL/Turso) SELECT statement. Use SQLite syntax; list tables via SELECT name FROM sqlite_master WHERE type='table'."),
  maxRows: z.number().int().min(1).max(500).default(100).describe("Maximum number of rows to return"),
});

const FORBIDDEN_SQL = [
  "insert", "update", "delete", "replace", "merge", "upsert",
  "drop", "alter", "create", "truncate", "rename",
  "attach", "detach", "pragma", "vacuum", "reindex", "analyze",
  "begin", "commit", "rollback", "savepoint", "release",
  "grant", "revoke", "trigger",
];

function validateSelectOnly(query: string): { ok: true; query: string } | { ok: false; error: string } {
  // Strip a single optional trailing semicolon; reject anything resembling stacked statements.
  const normalized = query.trim().replace(/;\s*$/, "");
  if (normalized.length === 0) return { ok: false, error: "Query is empty." };
  if (normalized.includes(";")) {
    return { ok: false, error: "Only a single statement is allowed (no ';' separators)." };
  }

  const lower = normalized.toLowerCase();
  if (!/^(select|with)\b/.test(lower)) {
    return { ok: false, error: "Only SELECT statements are allowed (the query must start with SELECT or WITH)." };
  }

  for (const keyword of FORBIDDEN_SQL) {
    if (new RegExp(`\\b${keyword}\\b`, "i").test(normalized)) {
      return { ok: false, error: `Disallowed keyword "${keyword}" — only read-only SELECT statements are permitted.` };
    }
  }

  return { ok: true, query: normalized };
}

export async function runSqlQuery(args: unknown, db: SqliteDb): Promise<McpToolResult> {
  const parsed = runSqlQuerySchema.safeParse(args);
  if (!parsed.success) return textResult(`Invalid arguments: ${parsed.error.message}`, true);

  const validation = validateSelectOnly(parsed.data.query);
  if (!validation.ok) return textResult(validation.error, true);

  let rows: Record<string, unknown>[];
  try {
    rows = (await db.all(sql.raw(validation.query))) as Record<string, unknown>[];
  } catch (err) {
    return textResult(`Query failed: ${err instanceof Error ? err.message : String(err)}`, true);
  }

  if (rows.length === 0) return textResult("Query succeeded and returned 0 rows.");

  const limited = rows.slice(0, parsed.data.maxRows);
  const truncatedNote = rows.length > limited.length
    ? `\n\n(showing first ${limited.length} of ${rows.length} rows)`
    : "";

  return textResult(`Returned ${rows.length} row(s):\n\n${JSON.stringify(limited, null, 2)}${truncatedNote}`);
}

const ingest = (merged: Map<string, MergedHit>, rows: { integrationArtifactId: string; content: string | null; distance: number }[]) => {
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
  return merged;
};

