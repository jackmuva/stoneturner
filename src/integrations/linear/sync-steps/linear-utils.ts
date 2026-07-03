import { getIntegrationCredentialByIntegration, upsertIntegrationCredential, upsertSyncTask } from "@/core/db/queries/queries";
import type { IntegrationCredential } from "@/core/db/schema/schema";
import type { SqliteDb } from "@/core/models/db-models";
import { retry } from "@/lib/utils";
import Bottleneck from "bottleneck";
import type { BunRequest } from "bun";
import type {
  LinearComment,
  LinearDocumentNode,
  LinearIssueNode,
  LinearPageInfo,
  LinearProjectNode,
  LinearTeam,
  LinearTokenResponse,
  StoredComment,
  StoredProjectUpdate,
} from "../models/models";

export const LINEAR_GRAPHQL = "https://api.linear.app/graphql";
export const LINEAR_TOKEN_URL = "https://api.linear.app/oauth/token";
export const LINEAR_REVOKE_URL = "https://api.linear.app/oauth/revoke";

export const linearApiBottleneck = new Bottleneck({
  maxConcurrent: 5,
  minTime: 200,
});

export const PAGE_SIZE_LINEAR = 50;

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
};

export const getLinearCredentials = async (db: SqliteDb) => {
  return await getIntegrationCredentialByIntegration("linear", db);
};

export const parseTeamKeys = (options: Record<string, string> | null | undefined): string[] => {
  const raw = options?.teamKeys ?? "";
  return raw
    .split(",")
    .map((k) => k.trim().toUpperCase())
    .filter(Boolean);
};

export const includeArchived = (options: Record<string, string> | null | undefined): boolean => {
  return (options?.includeArchived ?? "").trim().toLowerCase() === "true";
};

const tokenNeedsRefresh = (cred: IntegrationCredential): boolean => {
  if (!cred.tokenExpiration) return false;
  const expiresAt = new Date(cred.tokenExpiration).getTime();
  return Date.now() >= expiresAt - 5 * 60 * 1000;
};

export const handleLinearRefresh = async (db: SqliteDb): Promise<void> => {
  const cred = await getLinearCredentials(db);
  if (!cred?.refreshToken) return;
  if (!tokenNeedsRefresh(cred)) return;

  const clientId = process.env.BUN_PUBLIC_LINEAR_CLIENT_ID ?? "";
  const clientSecret = process.env.LINEAR_CLIENT_SECRET ?? "";

  const res = await fetch(LINEAR_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: cred.refreshToken,
    }),
  });

  if (!res.ok) {
    await upsertSyncTask({
      integration: "linear",
      status: "FAILED",
      step: "linear-token-revalidation",
      inputs: { error: await res.text() },
    }, db);
    return;
  }

  const token = await res.json() as LinearTokenResponse;
  await persistLinearTokens(cred, token, db);
};

export const ensureLinearAccessToken = async (db: SqliteDb): Promise<string> => {
  const cred = await getLinearCredentials(db);
  if (!cred?.accessToken) throw new Error("Missing Linear credential");

  if (tokenNeedsRefresh(cred)) {
    await handleLinearRefresh(db);
    const refreshed = await getLinearCredentials(db);
    if (!refreshed?.accessToken) throw new Error("Linear token refresh failed");
    return refreshed.accessToken;
  }

  return cred.accessToken;
};

const persistLinearTokens = async (
  cred: IntegrationCredential,
  token: LinearTokenResponse,
  db: SqliteDb,
) => {
  const tokenExpiration = new Date(Date.now() + token.expires_in * 1000).toISOString();
  await upsertIntegrationCredential({
    id: cred.id,
    integration: "linear",
    integrationType: "OAUTH",
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    tokenExpiration,
    options: cred.options ?? null,
  }, db);
};

export const handleOauthRedirect = async (req: BunRequest, db: SqliteDb): Promise<Response> => {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return Response.json({ error: "missing code" }, { status: 400 });

  const clientId = process.env.BUN_PUBLIC_LINEAR_CLIENT_ID ?? "";
  const clientSecret = process.env.LINEAR_CLIENT_SECRET ?? "";
  const redirectUri = `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/linear`;

  const res = await fetch(LINEAR_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) return Response.json({ error: "token exchange failed" }, { status: 502 });

  const token = await res.json() as LinearTokenResponse;
  const existing = await getLinearCredentials(db);

  await upsertIntegrationCredential({
    id: existing?.id ?? crypto.randomUUID(),
    integration: "linear",
    integrationType: "OAUTH",
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    tokenExpiration: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    options: existing?.options ?? null,
  }, db);

  return Response.redirect(process.env.BUN_PUBLIC_BACKEND_BASE_URL!, 302);
};

export const revokeLinearToken = async (token: string): Promise<void> => {
  const clientId = process.env.BUN_PUBLIC_LINEAR_CLIENT_ID ?? "";
  const clientSecret = process.env.LINEAR_CLIENT_SECRET ?? "";
  await fetch(LINEAR_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      token,
      token_type_hint: "access_token",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
};

export const linearGraphql = async <T>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
): Promise<T> => {
  return await linearApiBottleneck.schedule(() =>
    retry(async () => {
      const response = await fetch(LINEAR_GRAPHQL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables }),
      });

      const body = await response.json() as GraphQLResponse<T>;
      if (body.errors?.length) {
        const message = body.errors.map((e) => e.message).join("; ");
        throw new Error(message);
      }
      if (!body.data) throw new Error("Linear GraphQL returned no data");
      return body.data;
    }),
  );
};

const TEAMS_QUERY = `
  query Teams {
    teams {
      nodes {
        id
        key
        name
      }
    }
  }
`;

export const fetchLinearTeams = async (token: string, db: SqliteDb): Promise<LinearTeam[]> => {
  const cred = await getLinearCredentials(db);
  const configured = parseTeamKeys(cred?.options);
  const data = await linearGraphql<{ teams: { nodes: LinearTeam[] } }>(TEAMS_QUERY, {}, token);
  const teams = data.teams.nodes;
  if (configured.length === 0) return teams;
  const allowed = new Set(configured);
  return teams.filter((t) => allowed.has(t.key.toUpperCase()));
};

export const toStoredComment = (comment: LinearComment): StoredComment => ({
  author: comment.user?.name ?? null,
  body: comment.body ?? null,
  createdAt: comment.createdAt ?? null,
});

export const fetchAllIssueComments = async (
  issueId: string,
  initial: LinearComment[],
  pageInfo: LinearPageInfo | undefined,
  token: string,
): Promise<StoredComment[]> => {
  const comments = [...initial.map(toStoredComment)];
  let after = pageInfo?.hasNextPage ? pageInfo.endCursor : null;

  while (after) {
    const data = await linearGraphql<{
      issue: { comments: { nodes: LinearComment[]; pageInfo: LinearPageInfo } } | null;
    }>(ISSUE_COMMENTS_QUERY, { issueId, after }, token);

    const page = data.issue?.comments;
    if (!page) break;
    comments.push(...page.nodes.map(toStoredComment));
    after = page.pageInfo.hasNextPage ? (page.pageInfo.endCursor ?? null) : null;
  }

  return comments;
};

const ISSUE_COMMENTS_QUERY = `
  query IssueComments($issueId: String!, $after: String) {
    issue(id: $issueId) {
      comments(first: 100, after: $after) {
        nodes {
          id
          body
          createdAt
          user { name }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

export const issueToRow = async (
  issue: LinearIssueNode,
  teamKey: string,
  token: string,
) => {
  const comments = await fetchAllIssueComments(
    issue.id,
    issue.comments?.nodes ?? [],
    issue.comments?.pageInfo,
    token,
  );

  return {
    artifactId: `${teamKey}/${issue.identifier}`,
    issueId: issue.id,
    teamKey,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description ?? null,
    state: issue.state?.name ?? null,
    stateType: issue.state?.type ?? null,
    priority: issue.priority ?? null,
    estimate: issue.estimate ?? null,
    assignee: issue.assignee?.name ?? null,
    creator: issue.creator?.name ?? null,
    labels: issue.labels?.nodes.map((l) => l.name) ?? [],
    comments,
    projectName: issue.project?.name ?? null,
    cycleName: issue.cycle?.name ?? null,
    dueDate: issue.dueDate ?? null,
    url: issue.url ?? null,
    createdAt: issue.createdAt ?? null,
    updatedAt: issue.updatedAt ?? null,
  };
};

export const projectToRow = (project: LinearProjectNode) => {
  const updates: StoredProjectUpdate[] = (project.projectUpdates?.nodes ?? []).map((u) => ({
    body: u.body ?? null,
    health: u.health ?? null,
    author: u.user?.name ?? null,
    createdAt: u.createdAt ?? null,
  }));

  return {
    artifactId: `project/${project.id}`,
    projectId: project.id,
    name: project.name,
    description: project.description ?? null,
    state: project.state ?? null,
    progress: project.progress != null ? String(project.progress) : null,
    startDate: project.startDate ?? null,
    targetDate: project.targetDate ?? null,
    lead: project.lead?.name ?? null,
    teamKeys: project.teams?.nodes.map((t) => t.key) ?? [],
    updates,
    url: project.url ?? null,
    createdAt: project.createdAt ?? null,
    updatedAt: project.updatedAt ?? null,
  };
};

export const documentToRow = (doc: LinearDocumentNode) => ({
  artifactId: `doc/${doc.id}`,
  documentId: doc.id,
  title: doc.title,
  content: doc.content ?? null,
  url: doc.url ?? null,
  projectName: doc.project?.name ?? null,
  issueIdentifier: doc.issue?.identifier ?? null,
  issueTitle: doc.issue?.title ?? null,
  creator: doc.creator?.name ?? null,
  updatedBy: doc.updatedBy?.name ?? null,
  comments: (doc.comments?.nodes ?? []).map(toStoredComment),
  createdAt: doc.createdAt ?? null,
  updatedAt: doc.updatedAt ?? null,
});

export type LinearIssueCursor = { teamId: string; after: string | null };
export type LinearListCursor = { after: string | null };

export const teamsFromCursor = (teams: LinearTeam[], cursorTeamId?: string): LinearTeam[] => {
  if (!cursorTeamId) return teams;
  const idx = teams.findIndex((t) => t.id === cursorTeamId);
  return idx >= 0 ? teams.slice(idx) : teams;
};
