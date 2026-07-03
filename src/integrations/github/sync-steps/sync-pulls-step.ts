import { upsertSyncTask } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";
import type { GithubPull, GithubPullFile, GithubRepoRef, GithubReviewComment, StoredPullFile, StoredReviewComment } from "../models/models";
import { githubFetch, getConfiguredRepos, getGithubToken, nextLink } from "./github-utils";
import { batchInsertGithubPull, getLatestGithubPullUpdate } from "../db/queries";
import type { GithubPullInsert } from "../db/schema";

const STEP = "github-sync-pulls";

export const syncGithubPullsStep = async (incremental: boolean = false, db: SqliteDb) => {
  let token: string;
  let repos: GithubRepoRef[];
  try {
    token = await getGithubToken(db);
    repos = await getConfiguredRepos(db);
  } catch (e) {
    await upsertSyncTask({ integration: "github", status: "FAILED", step: STEP, inputs: { error: String(e) } }, db);
    return;
  }

  // The pulls endpoint has no `since` param, so page newest-first and stop once
  // we pass items older than the newest PR we already have.
  const since = incremental ? await getLatestGithubPullUpdate(db) : null;

  for (const { owner, repo } of repos) {
    let url: string | null = `/repos/${owner}/${repo}/pulls?state=all&per_page=100&direction=desc&sort=updated`;
    let done = false;

    while (url && !done) {
      try {
        const res = await githubFetch(url, token);
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
            repo: `${owner}/${repo}`,
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

        await upsertSyncTask({ integration: "github", status: "SUCCESS", step: STEP, inputs: { repo: `${owner}/${repo}`, count: rows.length } }, db);
        url = next;
      } catch (e) {
        await upsertSyncTask({ integration: "github", status: "FAILED", step: STEP, inputs: { repo: `${owner}/${repo}`, url, error: String(e) } }, db);
        break;
      }
    }
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
