import { upsertSyncTask } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";
import type { GithubPull, GithubPullFile, GithubRepoRef, GithubReviewComment, StoredPullFile, StoredReviewComment } from "../models/models";
import { githubFetch, getConfiguredRepos, getGithubToken, nextLink, reposFromCursor, repoKey, type GithubPaginatedCursor, type GithubPaginatedSyncInputs } from "./github-utils";
import { batchInsertGithubPull, getLatestGithubPullUpdate } from "../db/queries";
import type { GithubPullInsert } from "../db/schema";

const STEP = "github-sync-pulls";

export const syncGithubPullsStep = async (incremental: boolean = false, db: SqliteDb, inputs?: GithubPaginatedSyncInputs, syncTaskId?: string) => {
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

  // The pulls endpoint has no `since` param, so page newest-first and stop once
  // we pass items older than the newest PR we already have.
  const since = incremental ? await getLatestGithubPullUpdate(db) : null;

  for (const { owner, repo } of repos) {
    const key = repoKey(owner, repo);
    let url: string | null =
      cursor?.repo === key && cursor.url
        ? cursor.url
        : `/repos/${owner}/${repo}/pulls?state=all&per_page=100&direction=desc&sort=updated`;
    let done = false;

    while (url && !done) {
      const pageUrl = url;
      try {
        const res = await githubFetch(pageUrl, token);
        if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
        const pulls = (await res.json()) as GithubPull[];
        const next: string | null = nextLink(res);

        const rows: GithubPullInsert[] = [];
        for (const pull of pulls) {
          if (since && pull.updated_at <= since) {
            done = true;
            break;
          }
          const [files, reviewComments] = await Promise.all([
            fetchFiles(owner, repo, pull.number, token),
            fetchReviewComments(owner, repo, pull.number, token),
          ]);
          rows.push({
            artifactId: `${owner}/${repo}#pr-${pull.number}`,
            repo: key,
            number: pull.number,
            title: pull.title,
            body: pull.body,
            state: pull.state,
            author: pull.user?.login ?? null,
            files,
            reviewComments,
            htmlUrl: pull.html_url,
            createdAt: pull.created_at,
            updatedAt: pull.updated_at,
          });
        }
        await batchInsertGithubPull(rows, db);

        const nextCursor: GithubPaginatedCursor | null = next && !done ? { repo: key, url: next } : null;
        await upsertSyncTask({
          id: syncTaskId,
          integration: "github",
          status: "SUCCESS",
          step: STEP,
          inputs: nextCursor ? { repo: key, cursor: nextCursor } : { repo: key },
        }, db);
        url = next;
        if (inputs) break;
      } catch (e) {
        await upsertSyncTask({
          id: syncTaskId,
          integration: "github",
          status: "FAILED",
          step: STEP,
          inputs: { repo: key, cursor: { repo: key, url: pageUrl } },
          error: String(e),
        }, db);
        break;
      }
    }
    if (inputs) break;
  }
};

const fetchFiles = async (owner: string, repo: string, number: number, token: string): Promise<StoredPullFile[]> => {
  const all: StoredPullFile[] = [];
  let url: string | null = `/repos/${owner}/${repo}/pulls/${number}/files?per_page=100`;
  while (url) {
    const res = await githubFetch(url, token);
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
    const files = (await res.json()) as GithubPullFile[];
    all.push(...files.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: f.patch ?? null,
    })));
    url = nextLink(res);
  }
  return all;
};

const fetchReviewComments = async (owner: string, repo: string, number: number, token: string): Promise<StoredReviewComment[]> => {
  const all: StoredReviewComment[] = [];
  let url: string | null = `/repos/${owner}/${repo}/pulls/${number}/comments?per_page=100`;
  while (url) {
    const res = await githubFetch(url, token);
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
    const comments = (await res.json()) as GithubReviewComment[];
    all.push(...comments.map((c) => ({
      path: c.path,
      author: c.user?.login ?? null,
      body: c.body,
      diffHunk: c.diff_hunk ?? null,
      createdAt: c.created_at,
    })));
    url = nextLink(res);
  }
  return all;
};
