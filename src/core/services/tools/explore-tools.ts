import { tool } from "ai";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getMostRecentMdArtifactsByIntegration } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";
import type { McpToolResult } from "@/core/models/mcp-models";
import {
  getArtifactSchema,
  runGetArtifact,
  runSemanticSearch,
  runSqlQuery,
  runSqlQuerySchema,
  semanticSearchSchema,
} from "./search-tools";

const toText = (result: McpToolResult): string => result.content[0]?.text ?? "";

export function createExploreAgentTools(integration: string, db: SqliteDb) {
  const integrationLower = integration.toLowerCase();

  return {
    search_semantically: tool({
      description:
        "Semantic search across indexed artifact content, key points, and questions answered. " +
        "Searches all integrations by default; pass `integration` to filter to one source. " +
        "Use this to find related content by meaning, including cross-source connections.",
      inputSchema: semanticSearchSchema,
      execute: async (args) => toText(await runSemanticSearch(args, db)),
    }),

    get_artifact_by_id: tool({
      description:
        "Fetch the full markdown summary and metadata for a single artifact by primary id or integrationArtifactId. " +
        "Works across all integrations so you can follow up on cross-source search hits.",
      inputSchema: getArtifactSchema,
      execute: async (args) => toText(await runGetArtifact(args, db)),
    }),

    execute_sqlite_query: tool({
      description:
        "Run a single read-only SQL SELECT against the SQLite database and return rows as JSON. " +
        "Only SELECT (and WITH ... SELECT) statements are permitted.",
      inputSchema: runSqlQuerySchema,
      execute: async (args) => toText(await runSqlQuery(args, db)),
    }),

    get_tables: tool({
      description:
        `List database tables whose names contain "${integration}" (raw ${integration} sync tables). ` +
        "Does not include mdArtifacts — use get_most_recent_records or search_semantically for parsed artifacts.",
      inputSchema: z.object({}),
      execute: async () => {
        const pattern = `%${integrationLower}%`;
        const rows = await db.all<{ name: string; sql: string | null }>(
          sql`SELECT name, sql FROM sqlite_master WHERE type = 'table' AND lower(name) LIKE ${pattern} ORDER BY name`,
        );

        if (rows.length === 0) {
          return `No tables found matching integration "${integration}".`;
        }

        const blocks = rows.map((row) => {
          const ddl = row.sql ? `\n\`\`\`sql\n${row.sql}\n\`\`\`` : "";
          return `- **${row.name}**${ddl}`;
        });

        return `Found ${rows.length} table(s) for "${integration}":\n\n${blocks.join("\n\n")}`;
      },
    }),

    get_most_recent_records: tool({
      description:
        `Return the 5 most recent parsed artifacts for "${integration}" (by artifactDate), with key points preview.`,
      inputSchema: z.object({}),
      execute: async () => {
        const artifacts = await getMostRecentMdArtifactsByIntegration(db, integrationLower, 5);

        if (artifacts.length === 0) {
          return `No artifacts found for integration "${integration}".`;
        }

        const blocks = artifacts.map((artifact, i) => {
          const keyPointsList = artifact.keyPoints && artifact.keyPoints.length > 0
            ? artifact.keyPoints.map((kp) => `  - ${kp}`).join("\n")
            : "  (none)";
          return [
            `### ${i + 1}. ${artifact.integrationArtifactId}`,
            `- artifactDate: ${artifact.artifactDate ?? "unknown"}`,
            `- key points:`,
            keyPointsList,
          ].join("\n");
        });

        return `Most recent ${artifacts.length} artifact(s) for "${integration}":\n\n${blocks.join("\n\n")}`;
      },
    }),
  };
}
