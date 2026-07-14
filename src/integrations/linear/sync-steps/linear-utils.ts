import { getIntegrationCredentialByIntegration, upsertIntegrationCredential, upsertSyncTask } from "@/core/db/queries/queries";
import type { IntegrationCredential } from "@/core/db/schema/schema";
import type { SqliteDb } from "@/core/models/db-models";
import { retry } from "@/lib/utils";
import Bottleneck from "bottleneck";
import type { BunRequest } from "bun";
import type { LinearTokenResponse } from "../models/models";

export const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";
export const LINEAR_TOKEN_URL = "https://api.linear.app/oauth/token";
export const LINEAR_PAGE_SIZE = 50;

export const linearApiBottleneck = new Bottleneck({
  maxConcurrent: 1,
  minTime: 250,
});

export type LinearSyncCursor = {
  after?: string;
  watermark?: string;
};

export type LinearSyncInputs = {
  cursor?: LinearSyncCursor;
};

export type LinearParseCursor = {
  type: "issue" | "project";
  offset: number;
};

export type LinearParseInputs = {
  cursor?: LinearParseCursor;
} | { type: "issue" | "project" };

export const getLinearCredentials = async (db: SqliteDb): Promise<IntegrationCredential | undefined> => {
  return await getIntegrationCredentialByIntegration("linear", db);
};

const exchangeToken = async (body: URLSearchParams): Promise<LinearTokenResponse | null> => {
  const clientId = process.env.BUN_PUBLIC_LINEAR_CLIENT_ID ?? "";
  const clientSecret = process.env.LINEAR_CLIENT_SECRET ?? "";

  const res = await fetch(LINEAR_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body,
  });

  if (!res.ok) return null;
  return await res.json() as LinearTokenResponse;
};

const persistLinearToken = async (
  cred: { id: string; refreshToken?: string | null },
  token: LinearTokenResponse,
  db: SqliteDb,
): Promise<void> => {
  const tokenExpiration = new Date(Date.now() + token.expires_in * 1000).toISOString();
  await upsertIntegrationCredential({
    id: cred.id,
    integration: "linear",
    integrationType: "OAUTH",
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? cred.refreshToken,
    tokenExpiration,
  }, db);
};

export const handleLinearRefresh = async (db: SqliteDb, syncTaskId?: string): Promise<void> => {
  const cred = await getLinearCredentials(db);
  if (!cred?.refreshToken) return;

  const token = await exchangeToken(new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: cred.refreshToken,
  }));

  if (!token) {
    await upsertSyncTask({
      id: syncTaskId,
      integration: "linear",
      status: "FAILED",
      step: "linear-token-revalidation",
      error: "refresh failed",
    }, db);
    return;
  }

  await persistLinearToken(cred, token, db);
};

export const handleOauthRedirect = async (req: BunRequest, db: SqliteDb): Promise<Response> => {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) {
    return Response.json({ error: "missing code" }, { status: 400 });
  }

  const redirectUri = `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/linear`;
  const token = await exchangeToken(new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  }));

  if (!token) {
    return Response.json({ error: "token exchange failed" }, { status: 502 });
  }

  await persistLinearToken({ id: crypto.randomUUID() }, token, db);
  return Response.redirect(process.env.BUN_PUBLIC_BACKEND_BASE_URL!, 302);
};

export const linearGraphql = async <T>(
  query: string,
  variables: Record<string, unknown>,
  db: SqliteDb,
): Promise<T> => {
  const doFetch = async (): Promise<Response> => {
    const cred = await getLinearCredentials(db);
    if (!cred?.accessToken) throw new Error("Missing Linear credential");

    return await fetch(LINEAR_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cred.accessToken}`,
      },
      body: JSON.stringify({ query, variables }),
    });
  };

  let res = await linearApiBottleneck.schedule(() => doFetch());

  if (res.status === 401) {
    await handleLinearRefresh(db);
    res = await linearApiBottleneck.schedule(() => doFetch());
  }

  if (!res.ok) {
    throw new Error(`Linear ${res.status}: ${await res.text()}`);
  }

  const body = await res.json() as T & { errors?: { message: string }[] };
  if (body.errors?.length) {
    throw new Error(body.errors.map((e) => e.message).join("; "));
  }

  return body;
};

export const displayName = (user?: { name?: string | null; displayName?: string | null } | null): string | null => {
  if (!user) return null;
  return user.displayName ?? user.name ?? null;
};

export const issueArtifactId = (identifier: string): string => identifier;

export const projectArtifactId = (projectId: string): string => `project:${projectId}`;

export const syncLinearConnection = async <TNode, TResponse extends {
  data?: Record<string, {
    nodes: TNode[];
    pageInfo: { hasNextPage: boolean; endCursor?: string | null };
  }>;
}>(
  incremental: boolean,
  db: SqliteDb,
  config: {
    step: string;
    connectionField: string;
    query: string;
    getLatestUpdate: (db: SqliteDb) => Promise<string | null>;
    mapRows: (nodes: TNode[]) => Promise<void>;
  },
  inputs?: LinearSyncInputs,
  syncTaskId?: string,
): Promise<void> => {
  const cursor = inputs?.cursor;
  let after = cursor?.after;
  let watermark = cursor?.watermark;

  if (incremental && !watermark) {
    watermark = (await config.getLatestUpdate(db)) ?? undefined;
  }

  const filter = watermark ? { updatedAt: { gt: watermark } } : undefined;

  while (true) {
    try {
      const response = await retry(async () => await linearGraphql<TResponse>(
        config.query,
        { first: LINEAR_PAGE_SIZE, after: after ?? null, filter: filter ?? null },
        db,
      ));

      const connection = response.data?.[config.connectionField];
      if (!connection) throw new Error(`Missing ${config.connectionField} in Linear response`);

      await config.mapRows(connection.nodes);

      let nextWatermark = watermark;
      for (const node of connection.nodes as { updatedAt?: string }[]) {
        if (!node.updatedAt) continue;
        if (!nextWatermark || node.updatedAt > nextWatermark) {
          nextWatermark = node.updatedAt;
        }
      }

      const nextCursor: LinearSyncCursor = {
        ...(nextWatermark ? { watermark: nextWatermark } : {}),
        ...(connection.pageInfo.hasNextPage && connection.pageInfo.endCursor
          ? { after: connection.pageInfo.endCursor }
          : {}),
      };

      await upsertSyncTask({
        id: syncTaskId,
        integration: "linear",
        status: "SUCCESS",
        error: null,
        step: config.step,
        inputs: Object.keys(nextCursor).length ? { cursor: nextCursor } : {},
      }, db);

      if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor) break;
      after = connection.pageInfo.endCursor;
      if (inputs?.cursor !== undefined) break;
    } catch (e) {
      const failedCursor: LinearSyncCursor = {
        ...(watermark ? { watermark } : {}),
        ...(after ? { after } : {}),
      };

      await upsertSyncTask({
        id: syncTaskId,
        integration: "linear",
        status: "FAILED",
        step: config.step,
        inputs: Object.keys(failedCursor).length ? { cursor: failedCursor } : {},
        error: String(e),
      }, db);
      break;
    }
  }
};
