import { z } from "zod";
import {
  getAllSourceContext,
  getMdArtifactsByIntegration,
  getIntegrationCredentials,
  getIntegrationCredentialByIntegration,
  getSourceContextByIntegration,
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
  const contexts = await getAllSourceContext(db);
  const contextByIntegration = new Map(contexts.map((c) => [c.integration.toLowerCase(), c]));

  const blocks = supportedIntegrations.map((cfg, i) => {
    const integration = cfg.config.integration;
    const hasCredentials = connected.has(integration);
    const context = contextByIntegration.get(integration.toLowerCase());
    const contextLine = context?.context
      ? `- has context: yes (updated ${context.updateDate})\n`
      : "- has context: no (generated automatically after a sync completes)\n";

    return [
      `## ${i + 1}. ${integration}`,
      `- can sync: ${hasCredentials ? "yes\n" : "not yet, use sync_source to input credentials\n"}`,
      contextLine,
    ].join("");
  });

  return textResult(
    `Supported integration sources (${supportedIntegrations.length}). When a user first asks about a data source, start here or with get_data_source_context before searching.\n\n${blocks.join("\n\n")}`,
  );
}

export const getDataSourceContextSchema = z.object({
  integration: z.string().min(1).describe(
    "The integration to fetch context for (e.g. \"gong\"). Omit to return context for all sources that have one. Use get_integrated_data_sources to see valid names.",
  ),
});

export async function runGetDataSourceContext(args: unknown, db: SqliteDb): Promise<McpToolResult> {
  const parsed = getDataSourceContextSchema.safeParse(args);
  if (!parsed.success) return textResult(`Invalid arguments: ${parsed.error.message}`, true);

  const { integration } = parsed.data;

  const record = await getSourceContextByIntegration(integration, db);
  if (!record?.context) {
    return textResult(
      `No context document exists yet for "${integration}". Context is generated automatically after a sync completes. ` +
      "Call get_integrated_data_sources to check connection status, then sync_source to trigger a sync if needed.",
    );
  }

  return textResult(
    `# ${integration} — data source context\n` +
    `Updated: ${record.updateDate}\n\n` +
    record.context,
  );
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
