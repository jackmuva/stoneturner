import type { BunRequest } from "bun";
import { getIntegrationCredentials, getMdArtifactsByIntegration, getSyncTasksByIntegration, getSyncTasksByUpdateDateAfter, upsertIntegrationCredential } from "../db/queries/queries";
import type { IntegrationCredential, MdArtifactSelect, SyncTaskSelect } from "../db/schema/schema";

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
  const now: Date = new Date();
  now.setMinutes(now.getMinutes() - 1);
  const syncTasks = await getSyncTasksByUpdateDateAfter(now.toISOString());
  return Response.json({ syncTasks: syncTasks });
}

export async function handleGetSyncTasks(req: BunRequest): Promise<Response> {
  const { page, integration } = req.params;
  if(!page || !integration) return Response.json(null, {status: 400});
  const syncTasks: SyncTaskSelect[] = await getSyncTasksByIntegration(integration, Number(page)) ?? [];
  return Response.json({ syncTasks: syncTasks });
}

export async function handleGetArtifacts(req: BunRequest): Promise<Response> {
  const { page, integration } = req.params;
  if(!page || !integration) return Response.json(null, {status: 400});
  const artifacts: MdArtifactSelect[] = await getMdArtifactsByIntegration(integration, Number(page)) ?? [];
  return Response.json({ artifacts: artifacts});
}

