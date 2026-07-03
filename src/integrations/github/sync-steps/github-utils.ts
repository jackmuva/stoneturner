import { getIntegrationCredentialByIntegration, upsertIntegrationCredential } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";
import { retry } from "@/lib/utils";
import Bottleneck from "bottleneck";
import type { BunRequest } from "bun";
import type { GithubRepoInfo, GithubRepoRef } from "../models/models";

export const GITHUB_API = "https://api.github.com";

// GitHub allows 5,000 requests/hr on an authorized token. Throttle the codebase
// blob fan-out (and every other GitHub call) through this shared limiter.
export const githubApiBottleneck = new Bottleneck({
  maxConcurrent: 5,
  minTime: 200,
});

export const getGithubCredentials = async (db: SqliteDb) => {
  return await getIntegrationCredentialByIntegration("github", db);
};

export const getGithubToken = async (db: SqliteDb): Promise<string> => {
  const cred = await getGithubCredentials(db);
  if (!cred?.accessToken) throw new Error("Missing GitHub credential");
  return cred.accessToken;
};

// Parse the comma-separated `owner/repo` list stored in credential options.
export const parseRepos = (options: Record<string, string> | null | undefined): GithubRepoRef[] => {
  const raw = options?.repos ?? "";
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [owner, repo] = entry.split("/").map((p) => p.trim());
      return owner && repo ? { owner, repo } : null;
    })
    .filter((r): r is GithubRepoRef => r !== null);
};

export const getConfiguredRepos = async (db: SqliteDb): Promise<GithubRepoRef[]> => {
  const cred = await getGithubCredentials(db);
  return parseRepos(cred?.options);
};

export const getConfiguredBranch = async (db: SqliteDb): Promise<string | undefined> => {
  const cred = await getGithubCredentials(db);
  const branch = cred?.options?.branch?.trim();
  return branch ? branch : undefined;
};

// A retry-wrapped, bottlenecked GitHub REST fetch. `accept` overrides the media
// type (e.g. raw content). Returns the raw Response so callers can branch on 404.
export const githubFetch = async (
  path: string,
  token: string,
  accept: string = "application/vnd.github+json",
): Promise<Response> => {
  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
  return await githubApiBottleneck.schedule(() =>
    retry(async () =>
      await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: accept,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "stoneturner",
        },
      }),
    ),
  );
};

// Follows Link-header pagination, accumulating JSON arrays across pages.
export const githubFetchJson = async <T>(
  path: string,
  token: string,
  accept?: string,
): Promise<T> => {
  const res = await githubFetch(path, token, accept);
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${path}: ${await res.text()}`);
  return (await res.json()) as T;
};

// Extract the rel="next" URL from a GitHub `Link` response header (pagination).
export const nextLink = (res: Response): string | null => {
  const link = res.headers.get("link");
  if (!link) return null;
  for (const part of link.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1] ?? null;
  }
  return null;
};

export const getDefaultBranch = async (owner: string, repo: string, token: string): Promise<string> => {
  const info = await githubFetchJson<GithubRepoInfo>(`/repos/${owner}/${repo}`, token);
  return info.default_branch;
};

// GitHub OAuth App tokens don't expire, so there is no refresh flow — the
// redirect just persists the access token, preserving any repo options the
// dialog already saved on the credential row.
export const handleGithubOauthRedirect = async (req: BunRequest, db: SqliteDb) => {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return Response.json({ error: "missing code" }, { status: 400 });

  const clientId = process.env.BUN_PUBLIC_GITHUB_CLIENT_ID ?? "";
  const clientSecret = process.env.GITHUB_CLIENT_SECRET ?? "";

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/github`,
    }),
  });

  if (!res.ok) return Response.json({ error: "token exchange failed" }, { status: 502 });

  const token = (await res.json()) as { access_token?: string; error?: string };
  if (!token.access_token) return Response.json({ error: token.error ?? "no access token" }, { status: 502 });

  const existing = await getGithubCredentials(db);

  await upsertIntegrationCredential({
    id: existing?.id ?? crypto.randomUUID(),
    integration: "github",
    integrationType: "OAUTH",
    accessToken: token.access_token,
    options: existing?.options ?? null,
  }, db);

  return Response.redirect(process.env.BUN_PUBLIC_BACKEND_BASE_URL!, 302);
};
