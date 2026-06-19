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
} from "@/core/db/queries/queries";
import type { MdArtifactSelect } from "@/core/db/schema/schema";
import type { McpToolResult, MergedHit } from "@/core/models/mcp-models";
import { textResult } from "@/lib/utils";

export const semanticSearchSchema = z.object({
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

export async function runSemanticSearch(args: unknown): Promise<McpToolResult> {
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


export const getArtifactSchema = z.object({
  id: z
    .string()
    .min(1)
    .describe("The mdArtifacts primary id or the integrationArtifactId"),
});

export async function getArtifact(id: string): Promise<MdArtifactSelect | undefined> {
  const artifact = await getMdArtifactByIntegrationArtifactId(id);
  return artifact;
}

export async function runGetArtifact(args: unknown): Promise<McpToolResult> {
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


