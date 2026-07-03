import { upsertSyncTask } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";
import type { GithubRepoRef, GithubTreeResponse } from "../models/models";
import { githubFetch, githubFetchJson, getConfiguredBranch, getConfiguredRepos, getDefaultBranch, getGithubToken } from "./github-utils";
import { batchInsertGithubSourceFile } from "../db/queries";
import type { GithubSourceFileInsert } from "../db/schema";
import { PAGE_SIZE } from "@/lib/constants";

const STEP = "github-sync-code";
const MAX_FILE_BYTES = 100 * 1024; // 100 KB

const EXCLUDED_DIRS = ["node_modules/", "dist/", "build/", "out/", ".git/", "vendor/", "coverage/", ".next/", ".cache/"];

const BINARY_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".eot", ".ttf",
  ".mp3", ".mp4", ".mov", ".zip", ".tar", ".gz", ".br", ".webp", ".avif",
];

const INCLUDE_EXTENSIONS = [
  // source
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".rb", ".php", ".c", ".cpp",
  ".h", ".hpp", ".cs", ".swift", ".kt", ".scala", ".mjs", ".cjs", ".mts", ".cts", ".vue", ".svelte",
  // config / doc
  ".json", ".yaml", ".yml", ".toml", ".md", ".css", ".scss", ".less", ".sql",
];

const isExcluded = (path: string): boolean => {
  const lower = path.toLowerCase();
  if (EXCLUDED_DIRS.some((dir) => lower.includes(dir))) return true;
  if (BINARY_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
  return false;
};

const isIncluded = (path: string): boolean => INCLUDE_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext));

export const syncGithubCodeStep = async (_incremental: boolean = false, db: SqliteDb) => {
  let token: string;
  let repos: GithubRepoRef[];
  let configuredBranch: string | undefined;
  try {
    token = await getGithubToken(db);
    repos = await getConfiguredRepos(db);
    configuredBranch = await getConfiguredBranch(db);
  } catch (e) {
    await upsertSyncTask({ integration: "github", status: "FAILED", step: STEP, inputs: { error: String(e) } }, db);
    return;
  }

  for (const { owner, repo } of repos) {
    try {
      const branch = configuredBranch ?? (await getDefaultBranch(owner, repo, token));
      const tree = await githubFetchJson<GithubTreeResponse>(
        `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        token,
      );

      if (tree.truncated) {
        await upsertSyncTask({ integration: "github", status: "FAILED", step: STEP, inputs: { repo: `${owner}/${repo}`, note: "tree truncated — repo too large to fully enumerate" } }, db);
      }

      const blobs = tree.tree.filter((entry) =>
        entry.type === "blob" &&
        isIncluded(entry.path) &&
        !isExcluded(entry.path) &&
        (entry.size ?? 0) <= MAX_FILE_BYTES,
      );

      // Batch blob fetches so a failure only fails a chunk, not the whole repo.
      // Each githubFetch is already throttled through the shared bottleneck.
      let synced = 0;
      for (let i = 0; i < blobs.length; i += PAGE_SIZE) {
        const chunk = blobs.slice(i, i + PAGE_SIZE);
        try {
          const results = await Promise.allSettled(
            chunk.map(async (entry): Promise<GithubSourceFileInsert> => {
              const content = await fetchBlob(owner, repo, entry.sha, token);
              return {
                artifactId: `${owner}/${repo}:code:${entry.path}`,
                repo: `${owner}/${repo}`,
                path: entry.path,
                sha: entry.sha,
                size: entry.size ?? content.length,
                isMarkdown: entry.path.toLowerCase().endsWith(".md"),
                content,
              };
            }),
          );

          const rows = results.filter((r): r is PromiseFulfilledResult<GithubSourceFileInsert> => r.status === "fulfilled").map((r) => r.value);
          const failures = results.filter((r) => r.status === "rejected").map((r) => String((r as PromiseRejectedResult).reason));
          await batchInsertGithubSourceFile(rows, db);
          synced += rows.length;

          await upsertSyncTask({
            integration: "github",
            status: failures.length ? "FAILED" : "SUCCESS",
            step: STEP,
            inputs: failures.length ? { repo: `${owner}/${repo}`, count: rows.length, errors: failures } : { repo: `${owner}/${repo}`, count: rows.length },
          }, db);
        } catch (e) {
          await upsertSyncTask({ integration: "github", status: "FAILED", step: STEP, inputs: { repo: `${owner}/${repo}`, offset: i, error: String(e) } }, db);
        }
      }

      await upsertSyncTask({ integration: "github", status: "SUCCESS", step: STEP, inputs: { repo: `${owner}/${repo}`, branch, totalSynced: synced } }, db);
    } catch (e) {
      await upsertSyncTask({ integration: "github", status: "FAILED", step: STEP, inputs: { repo: `${owner}/${repo}`, error: String(e) } }, db);
    }
  }
};

const fetchBlob = async (owner: string, repo: string, sha: string, token: string): Promise<string> => {
  const res = await githubFetch(`/repos/${owner}/${repo}/git/blobs/${sha}`, token, "application/vnd.github.raw");
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  return await res.text();
};
