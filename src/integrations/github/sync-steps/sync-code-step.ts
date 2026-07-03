import { upsertSyncTask } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";
import type { GithubRepoRef, GithubTreeResponse } from "../models/models";
import { githubFetch, githubFetchJson, getConfiguredBranch, getConfiguredRepos, getDefaultBranch, getGithubToken, reposFromCursor, repoKey, type GithubCodeCursor } from "./github-utils";
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

export const syncGithubCodeStep = async (_incremental: boolean = false, db: SqliteDb, cursor?: GithubCodeCursor) => {
  let token: string;
  let repos: GithubRepoRef[];
  let configuredBranch: string | undefined;
  try {
    token = await getGithubToken(db);
    repos = reposFromCursor(await getConfiguredRepos(db), cursor?.repo);
    configuredBranch = await getConfiguredBranch(db);
  } catch (e) {
    await upsertSyncTask({ integration: "github", status: "FAILED", step: STEP, inputs: { error: String(e) } }, db);
    return;
  }

  for (const { owner, repo } of repos) {
    const key = repoKey(owner, repo);
    try {
      const branch = configuredBranch ?? (await getDefaultBranch(owner, repo, token));
      const tree = await githubFetchJson<GithubTreeResponse>(
        `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        token,
      );

      if (tree.truncated) {
        await upsertSyncTask({ integration: "github", status: "FAILED", step: STEP, inputs: { repo: key, note: "tree truncated — repo too large to fully enumerate" } }, db);
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
      const startOffset = cursor?.repo === key ? cursor.offset : 0;
      for (let i = startOffset; i < blobs.length; i += PAGE_SIZE) {
        const chunk = blobs.slice(i, i + PAGE_SIZE);
        try {
          const results = await Promise.allSettled(
            chunk.map(async (entry): Promise<GithubSourceFileInsert> => {
              const content = await fetchBlob(owner, repo, entry.sha, token);
              return {
                artifactId: `${owner}/${repo}:code:${entry.path}`,
                repo: key,
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

          const nextOffset = i + PAGE_SIZE;
          const nextCursor: GithubCodeCursor | null = nextOffset < blobs.length ? { repo: key, offset: nextOffset } : null;
          await upsertSyncTask({
            integration: "github",
            status: failures.length ? "FAILED" : "SUCCESS",
            step: STEP,
            inputs: failures.length
              ? { repo: key, count: rows.length, cursor: { repo: key, offset: i }, errors: failures }
              : nextCursor
                ? { repo: key, count: rows.length, cursor: nextCursor }
                : { repo: key, count: rows.length },
          }, db);
          if (cursor) break;
        } catch (e) {
          await upsertSyncTask({
            integration: "github",
            status: "FAILED",
            step: STEP,
            inputs: { repo: key, cursor: { repo: key, offset: i }, error: String(e) },
          }, db);
          break;
        }
      }

      if (!cursor) {
        await upsertSyncTask({ integration: "github", status: "SUCCESS", step: STEP, inputs: { repo: key, branch, totalSynced: synced } }, db);
      }
    } catch (e) {
      await upsertSyncTask({ integration: "github", status: "FAILED", step: STEP, inputs: { repo: key, error: String(e) } }, db);
    }
    if (cursor) break;
  }
};

const fetchBlob = async (owner: string, repo: string, sha: string, token: string): Promise<string> => {
  const res = await githubFetch(`/repos/${owner}/${repo}/git/blobs/${sha}`, token, "application/vnd.github.raw");
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  return await res.text();
};
