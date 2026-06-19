import { z } from "zod";
import {
  getMdArtifactsByIntegration,
  getIntegrationCredentials,
} from "@/core/db/queries/queries";
import type { McpToolResult } from "@/core/models/mcp-models";
import { configRegistry } from "@/integrations/config-registry";
import { textResult } from "@/lib/utils";

export const getIntegrationSourcesSchema = z.object({});

export async function runGetIntegrationSources(_args: unknown): Promise<McpToolResult> {
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

export const syncSourceSchema = z.object({
  integration: z
    .string()
    .min(1)
    .describe("The integration source to sync (e.g. \"gong\"). Use get_integration_sources to see valid names."),
});

export async function runSyncSource(args: unknown): Promise<McpToolResult> {
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
