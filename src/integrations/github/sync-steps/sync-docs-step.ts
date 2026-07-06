import { upsertSyncTask } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";
import type { GithubContentEntry, GithubRepoRef } from "../models/models";
import { githubFetch, githubFetchJson, getConfiguredRepos, getGithubToken, reposFromCursor, repoKey, type GithubDocsCursor, type GithubDocsSyncInputs } from "./github-utils";
import { batchInsertGithubDoc } from "../db/queries";
import type { GithubDocInsert } from "../db/schema";

const STEP = "github-sync-docs";

export const syncGithubDocsStep = async (_incremental: boolean = false, db: SqliteDb, inputs?: GithubDocsSyncInputs, syncTaskId?: string) => {
  const cursor = inputs?.cursor;
  let token: string;
  let repos: GithubRepoRef[];
  try {
    token = await getGithubToken(db);
    repos = reposFromCursor(await getConfiguredRepos(db), inputs?.repo ?? cursor?.repo);
  } catch (e) {
    await upsertSyncTask({ id: syncTaskId, integration: "github", status: "FAILED", step: STEP, error: String(e) }, db);
    return;
  }

  for (const { owner, repo } of repos) {
    const key = repoKey(owner, repo);
    try {
      const paths = new Set<string>();
      await collectMarkdownPaths(owner, repo, "", token, paths, true);
      await collectMarkdownPaths(owner, repo, "docs", token, paths, false);
      const orderedPaths = ["README", ...[...paths].sort()];

      const startIndex = cursor?.repo === key ? cursor.pathIndex : 0;
      for (let i = startIndex; i < orderedPaths.length; i++) {
        const path = orderedPaths[i]!;
        try {
          const row = path === "README"
            ? await fetchReadmeRow(owner, repo, key, token)
            : await fetchDocRow(owner, repo, key, path, token);
          if (row) await batchInsertGithubDoc([row], db);

          const nextCursor: GithubDocsCursor | null = i + 1 < orderedPaths.length
            ? { repo: key, pathIndex: i + 1 }
            : null;
          await upsertSyncTask({
            id: syncTaskId,
            integration: "github",
            status: "SUCCESS",
            step: STEP,
            inputs: nextCursor ? { repo: key, path, cursor: nextCursor } : { repo: key, path },
          }, db);
        } catch (e) {
          await upsertSyncTask({
            id: syncTaskId,
            integration: "github",
            status: "FAILED",
            step: STEP,
            inputs: { repo: key, path, cursor: { repo: key, pathIndex: i } },
            error: String(e),
          }, db);
          break;
        }
        if (inputs) break;
      }
    } catch (e) {
      await upsertSyncTask({
        id: syncTaskId,
        integration: "github",
        status: "FAILED",
        step: STEP,
        inputs: { repo: key, cursor: { repo: key, pathIndex: 0 } },
        error: String(e),
      }, db);
    }
    if (inputs) break;
  }
};

const fetchReadmeRow = async (owner: string, repo: string, key: string, token: string): Promise<GithubDocInsert | null> => {
  const readme = await fetchReadme(owner, repo, token);
  if (!readme) return null;
  return {
    artifactId: `${owner}/${repo}:doc:README`,
    repo: key,
    path: "README",
    content: readme,
    sha: null,
  };
};

const fetchDocRow = async (owner: string, repo: string, key: string, path: string, token: string): Promise<GithubDocInsert | null> => {
  const { content, sha } = await fetchRawFile(owner, repo, path, token);
  if (content === null) return null;
  return {
    artifactId: `${owner}/${repo}:doc:${path}`,
    repo: key,
    path,
    content,
    sha,
  };
};

const fetchReadme = async (owner: string, repo: string, token: string): Promise<string | null> => {
  const res = await githubFetch(`/repos/${owner}/${repo}/readme`, token, "application/vnd.github.raw+json");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  return await res.text();
};

// List a directory and collect `.md` file paths. When `rootOnly`, only pick up
// markdown files at that level; otherwise recurse into subdirectories.
const collectMarkdownPaths = async (
  owner: string,
  repo: string,
  dir: string,
  token: string,
  out: Set<string>,
  rootOnly: boolean,
): Promise<void> => {
  const res = await githubFetch(`/repos/${owner}/${repo}/contents/${dir}`, token);
  if (res.status === 404) return;
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  const entries = (await res.json()) as GithubContentEntry[] | GithubContentEntry;
  const list = Array.isArray(entries) ? entries : [entries];

  for (const entry of list) {
    if (entry.type === "file" && entry.name.toLowerCase().endsWith(".md")) {
      out.add(entry.path);
    } else if (entry.type === "dir" && !rootOnly) {
      await collectMarkdownPaths(owner, repo, entry.path, token, out, false);
    }
  }
};

const fetchRawFile = async (owner: string, repo: string, path: string, token: string): Promise<{ content: string | null; sha: string | null }> => {
  const meta = await githubFetchJson<GithubContentEntry>(`/repos/${owner}/${repo}/contents/${path}`, token).catch(() => null);
  const res = await githubFetch(`/repos/${owner}/${repo}/contents/${path}`, token, "application/vnd.github.raw");
  if (res.status === 404) return { content: null, sha: null };
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  return { content: await res.text(), sha: meta?.sha ?? null };
};
