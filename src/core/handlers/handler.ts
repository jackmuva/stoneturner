import type { BunRequest } from "bun";
import { getIntegrationCredentials, getMdArtifactById, getMdArtifactsByIntegration, getSyncTasks, getSyncTasksByIntegration, getSyncTasksByStatus, getSyncTasksFiltered, getDistinctSyncTaskSteps, upsertIntegrationCredential, deleteSyncTasksPriorToDate, type MdArtifactSortField, type SortOrder, upsertSyncPipeline, deleteSyncPipelineByIntegration, getSyncPipelineByIntegration, getAllSyncPipelines } from "../db/queries/queries";
import type { IntegrationCredential, MdArtifactSelect, SyncTaskSelect } from "../db/schema/schema";
import type { SqliteDb } from "../models/db-models";

export async function handleGetIntegrations(req: BunRequest, db?: SqliteDb): Promise<Response> {
  const integrations = await getIntegrationCredentials(db!);
  return Response.json({ integrations: integrations });
}

export async function handleNewIntegrationCredential(req: BunRequest, db?: SqliteDb): Promise<Response> {
  const body = (await req.json()) as IntegrationCredential;

  const integrations = await upsertIntegrationCredential(body, db!);
  return Response.json({ integrations: integrations });
}

export async function handleGetAllSyncTasks(req: BunRequest, db?: SqliteDb): Promise<Response> {
  const url = new URL(req.url);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const sortOrderParam = url.searchParams.get("sortOrder");
  const sortOrder: SortOrder = sortOrderParam === "asc" ? "asc" : "desc";

  const integrationParam = url.searchParams.get("integration");
  const integration = integrationParam && integrationParam !== "all" ? integrationParam : undefined;

  const statusParam = url.searchParams.get("status");
  const status = statusParam === "SUCCESS" || statusParam === "FAILED" || statusParam === "PENDING" ? statusParam : undefined;

  const stepParam = url.searchParams.get("step");
  const step = stepParam && stepParam !== "all" ? stepParam : undefined;

  const syncTasks = await getSyncTasksFiltered({ integration, status, step, offset, sortOrder }, db!);
  return Response.json({ syncTasks: syncTasks });
}

export async function handleGetSyncTaskSteps(db?: SqliteDb): Promise<Response> {
  const steps = await getDistinctSyncTaskSteps(db!);
  return Response.json({ steps });
}

export async function handleGetSyncTasks(req: BunRequest, db?: SqliteDb): Promise<Response> {
  const { integration } = req.params;
  const url = new URL(req.url);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  if (!integration) return Response.json(null, { status: 400 });
  const syncTasks: SyncTaskSelect[] = await getSyncTasksByIntegration(integration, offset, undefined, db!) ?? [];
  return Response.json({ syncTasks: syncTasks });
}

export async function handleGetArtifacts(req: BunRequest, db?: SqliteDb): Promise<Response> {
  const { integration } = req.params;
  if (!integration) return Response.json(null, { status: 400 });

  const url = new URL(req.url);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const search = url.searchParams.get("search") ?? undefined;
  const sortByParam = url.searchParams.get("sortBy");
  const sortBy: MdArtifactSortField | undefined = sortByParam === "artifactDate" || sortByParam === "updateDate" ? sortByParam : undefined;
  const sortOrderParam = url.searchParams.get("sortOrder");
  const sortOrder: SortOrder | undefined = sortOrderParam === "asc" || sortOrderParam === "desc" ? sortOrderParam : undefined;

  const artifacts: MdArtifactSelect[] = await getMdArtifactsByIntegration(db!, integration, offset, {
    search,
    sortBy,
    sortOrder,
  }) ?? [];
  return Response.json({ artifacts: artifacts });
}

export async function handleGetArtifactById(req: BunRequest, db?: SqliteDb): Promise<Response> {
  const { id } = req.params;
  if (!id) return Response.json(null, { status: 400 });

  const [artifact] = await getMdArtifactById(id, db!);
  if (!artifact) return Response.json(null, { status: 404 });
  return Response.json({ artifact });
}

export async function handleGetAllSyncPipelines(_req: BunRequest, db?: SqliteDb): Promise<Response> {
  const syncPipelines = await getAllSyncPipelines(db!);
  return Response.json({ syncPipelines });
}

export async function handleGetSyncPipelineByIntegration(req: BunRequest, db?: SqliteDb): Promise<Response> {
  const { integration } = req.params;
  if (!integration) return Response.json(null, { status: 400 });
  const syncPipeline = await getSyncPipelineByIntegration(integration, db!);
  return Response.json({ syncPipeline: syncPipeline ?? null });
}

export async function handleConfigureSyncPipeline(req: BunRequest, db?: SqliteDb): Promise<Response> {
  const body = (await req.json()) as { integration: string, frequency: "DAILY" | "WEEKLY" | "MONTHLY" };
  await upsertSyncPipeline({
    integration: body.integration,
    frequency: body.frequency
  }, db!)
  return Response.json(null, { status: 200 });
}

export async function handleDeleteSyncPipeline(req: BunRequest, db?: SqliteDb): Promise<Response> {
  const { integration } = req.params;
  if(!integration) return Response.json(null, {status: 400});
  await deleteSyncPipelineByIntegration(integration, db!);
  return Response.json(null, { status: 200 });
}
