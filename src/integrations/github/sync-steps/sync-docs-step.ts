import { upsertSyncTask } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";
import type { GithubContentEntry, GithubRepoRef } from "../models/models";
import { githubFetch, githubFetchJson, getConfiguredRepos, getGithubToken } from "./github-utils";
import { batchInsertGithubDoc } from "../db/queries";
import type { GithubDocInsert } from "../db/schema";

const STEP = "github-sync-docs";

export const syncGithubDocsStep = async (_incremental: boolean = false, db: SqliteDb) => {
  let token: string;
  let repos: GithubRepoRef[];
  try {
    token = await getGithubToken(db);
    repos = await getConfiguredRepos(db);
  } catch (e) {
    await upsertSyncTask({ integration: "github", status: "FAILED", step: STEP, inputs: { error: String(e) } }, db);
    return;
  }

  for (const { owner, repo } of repos) {
    try {
      const rows: GithubDocInsert[] = [];

      // README
      const readme = await fetchReadme(owner, repo, token);
      if (readme) {
        rows.push({
          artifactId: `${owner}/${repo}:doc:README`,
          repo: `${owner}/${repo}`,
          path: "README",
          content: readme,
          sha: null,
        });
      }

      // Root-level .md files + recurse into docs/
      const paths = new Set<string>();
      await collectMarkdownPaths(owner, repo, "", token, paths, true);
      await collectMarkdownPaths(owner, repo, "docs", token, paths, false);

      for (const path of paths) {
        const { content, sha } = await fetchRawFile(owner, repo, path, token);
        if (content === null) continue;
        rows.push({
          artifactId: `${owner}/${repo}:doc:${path}`,
          repo: `${owner}/${repo}`,
          path,
          content,
          sha,
        });
      }

      await batchInsertGithubDoc(rows, db);
      await upsertSyncTask({ integration: "github", status: "SUCCESS", step: STEP, inputs: { repo: `${owner}/${repo}`, count: rows.length } }, db);
    } catch (e) {
      await upsertSyncTask({ integration: "github", status: "FAILED", step: STEP, inputs: { repo: `${owner}/${repo}`, error: String(e) } }, db);
    }
  }
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
