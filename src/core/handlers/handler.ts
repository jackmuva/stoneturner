import type { BunRequest } from "bun";
import { getIntegrationCredentials, getMdArtifactsByIntegration, getSyncTasksByIntegration, getSyncTasksByUpdateDateAfter, upsertIntegrationCredential, type MdArtifactSortField, type SortOrder } from "../db/queries/queries";
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
  const { integration } = req.params;
  const url = new URL(req.url);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  if (!integration) return Response.json(null, { status: 400 });
  const syncTasks: SyncTaskSelect[] = await getSyncTasksByIntegration(integration, offset) ?? [];
  return Response.json({ syncTasks: syncTasks });
}

export async function handleGetArtifacts(req: BunRequest): Promise<Response> {
  const { integration } = req.params;
  if (!integration) return Response.json(null, { status: 400 });

  const url = new URL(req.url);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const search = url.searchParams.get("search") ?? undefined;
  const sortByParam = url.searchParams.get("sortBy");
  const sortBy: MdArtifactSortField | undefined = sortByParam === "artifactDate" || sortByParam === "updateDate" ? sortByParam : undefined;
  const sortOrderParam = url.searchParams.get("sortOrder");
  const sortOrder: SortOrder | undefined = sortOrderParam === "asc" || sortOrderParam === "desc" ? sortOrderParam : undefined;

  const artifacts: MdArtifactSelect[] = await getMdArtifactsByIntegration(integration, offset, {
    search,
    sortBy,
    sortOrder,
  }) ?? [];
  return Response.json({ artifacts: artifacts });
}

