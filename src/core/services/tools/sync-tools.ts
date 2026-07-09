import { z } from "zod";
import {
  getMdArtifactsByIntegration,
  getIntegrationCredentials,
  getIntegrationCredentialByIntegration,
} from "@/core/db/queries/queries";
import type { McpToolResult } from "@/core/models/mcp-models";
import type { SqliteDb } from "@/core/models/db-models";
import { supportedIntegrations } from "@/integrations/integration-registry";
import { textResult } from "@/lib/utils";

export const getIntegrationSourcesSchema = z.object({});

export async function runGetIntegrationSources(_args: unknown, db: SqliteDb): Promise<McpToolResult> {
  if (supportedIntegrations.length === 0) return textResult("No integration sources are configured.");

  const credentials = await getIntegrationCredentials(db);
  const connected = new Set(credentials.map((c) => c.integration));

  const blocks = supportedIntegrations.map((cfg, i) => {
    const hasCredentials = connected.has(cfg.config.integration);
    return [
      `## ${i + 1}. ${cfg.config.integration}`,
      `- can sync: ${hasCredentials ? "yes\n" : "not yet, use the syncSource tool to input credentials\n"}`,
    ].join("\n");
  });

  return textResult(`Supported integration sources (${supportedIntegrations.length}):\n\n${blocks.join("\n\n")}`,);
}

export const syncSourceSchema = z.object({
  integration: z.string().min(1).describe("The integration source to sync (e.g. \"gong\"). Use get_integrated_data_sources to see valid names."),
});

export async function runSyncSource(args: unknown, db: SqliteDb): Promise<McpToolResult> {
  const parsed = syncSourceSchema.safeParse(args);
  if (!parsed.success) return textResult(`Invalid arguments: ${parsed.error.message}`, true);

  const { integration } = parsed.data;
  const cfg = supportedIntegrations.find((integ) => integ.config.integration.toLowerCase() === integration.toLowerCase());
  if (!cfg) return textResult(`Unknown integration "${integration}". Use get_integrated_data_sources to see valid names.`, true);

  const credential = await getIntegrationCredentialByIntegration(integration, db);
  if (!credential) return textResult(`Open [${integration} config](${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/knowledge/config/${integration}) to connect.`, false);

  const isIncremental = (await getMdArtifactsByIntegration(db, integration, undefined, undefined)).length > 0;

  isIncremental ? cfg.syncUpdates(db) : cfg.sync(db);

  return textResult(
    isIncremental
      ? `Started an incremental sync for "${integration}". New and updated artifacts will be ingested in the background.`
      : `Started a full sync for "${integration}". Artifacts will be ingested in the background.`,
  );
}
