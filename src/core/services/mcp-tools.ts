import { z } from "zod";
import { embedTexts } from "@/core/services/embedding";
import {
  searchContentEmbeddingByCosine,
  searchKeyPointsEmbeddingByCosine,
  searchQuestionsAnsweredEmbeddingByCosine,
} from "@/core/db/queries/vector-queries";
import {
  getMdArtifactByIntegrationArtifactId,
} from "@/core/db/queries/queries";
import type { MdArtifactSelect } from "@/core/db/schema/schema";
import type { McpToolResult } from "@/core/models/mcp-models";

export interface McpTool {
  name: string;
  description: string;
  annotations: {
    title: string;
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
  inputSchema: z.ZodType;
  handler: (args: unknown) => Promise<McpToolResult>;
}

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
});

interface MergedHit {
  integrationArtifactId: string;
  distance: number;
  content: string | null;
  sources: Set<string>;
}

async function runSemanticSearch(args: unknown): Promise<McpToolResult> {
  const parsed = semanticSearchSchema.safeParse(args);
  if (!parsed.success) {
    return textResult(`Invalid arguments: ${parsed.error.message}`, true);
  }
  const { query, limit } = parsed.data;

  const [embedding] = await embedTexts([query]);
  if (!embedding) {
    return textResult("Failed to embed the query.", true);
  }

  const [content, keyPoints, questions] = await Promise.all([
    searchContentEmbeddingByCosine(embedding, limit),
    searchKeyPointsEmbeddingByCosine(embedding, limit),
    searchQuestionsAnsweredEmbeddingByCosine(embedding, limit),
  ]);

  const merged = new Map<string, MergedHit>();
  const ingest = (
    rows: { integrationArtifactId: string; content: string | null; distance: number }[],
    source: string,
  ) => {
    for (const row of rows) {
      const existing = merged.get(row.integrationArtifactId);
      if (existing) {
        existing.sources.add(source);
        if (row.distance < existing.distance) {
          existing.distance = row.distance;
          existing.content = row.content;
        }
      } else {
        merged.set(row.integrationArtifactId, {
          integrationArtifactId: row.integrationArtifactId,
          distance: row.distance,
          content: row.content,
          sources: new Set([source]),
        });
      }
    }
  };
  ingest(content, "content");
  ingest(keyPoints, "keyPoints");
  ingest(questions, "questionsAnswered");

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
    const sources = [...hit.sources].join(", ");
    const artifact = artifacts[i];
    const keyPointsList =
      artifact?.keyPoints && artifact.keyPoints.length > 0
        ? artifact.keyPoints.map((kp: string) => `  - ${kp}`).join("\n")
        : "  (none)";
    return [
      `### ${i + 1}. ${hit.integrationArtifactId}`,
      `- similarity: ${similarity} (matched in: ${sources})`,
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
    `# Artifact ${artifact.integrationArtifactId}`,
    `- integration: ${artifact.integration}`,
    `- artifactDate: ${artifact.artifactDate ?? "unknown"}`,
    fmtList("Key Points", artifact.keyPoints),
    fmtList("Questions Answered", artifact.questionsAnswered),
    fmtList("Entities", artifact.entities),
    `## Summary\n${artifact.markdown ?? "(no markdown)"}`,
  ].join("\n\n");

  return textResult(text);
}

export const tools: McpTool[] = [
  {
    name: "semantic_search",
    description:
      "Semantic search across indexed call content, extracted key points, and questions answered. Returns the most relevant artifacts with their key points. Use the returned integrationArtifactId with get_md_artifact_by_id to read the full summary.",
    annotations: { title: "Semantic search", ...READ_ONLY },
    inputSchema: semanticSearchSchema,
    handler: runSemanticSearch,
  },
  {
    name: "get_md_artifact_by_id",
    description:
      "Fetch the full markdown summary and metadata for a single mdArtifact by its id. Accepts either the mdArtifacts primary id or the integrationArtifactId.",
    annotations: { title: "Get artifact by id", ...READ_ONLY },
    inputSchema: getArtifactSchema,
    handler: runGetArtifact,
  },
];

export const toolsByName = new Map(tools.map((t) => [t.name, t]));
