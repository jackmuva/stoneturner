import type { BunRequest } from "bun";
import { getIntegrationCredentials, getSyncTasksByIntegrationAndUpdateDateAfter, upsertIntegrationCredential } from "../db/queries/queries";
import type { IntegrationCredential } from "../db/schema/schema";

export async function handleGetIntegrations(req: BunRequest): Promise<Response> {
  const integrations = await getIntegrationCredentials();
  return Response.json({ integrations: integrations });
}

export async function handleNewIntegrationCredential(req: BunRequest): Promise<Response> {
  const body = (await req.json()) as IntegrationCredential;

  const integrations = await upsertIntegrationCredential(body);
  return Response.json({ integrations: integrations });
}

export async function handleGetRecentSyncTasks(req: BunRequest): Promise<Response> {
  const body = (await req.json()) as {integration: string};
  const now: Date = new Date();
  now.setMinutes(now.getMinutes() - 1);
  const syncTasks = await getSyncTasksByIntegrationAndUpdateDateAfter(body.integration, now.toISOString());
  return Response.json({ syncTasks: syncTasks });
}

