import { upsertSyncTask } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";
import type { GithubComment, GithubIssue, GithubRepoRef, StoredComment } from "../models/models";
import { githubFetch, getConfiguredRepos, getGithubToken, nextLink, reposFromCursor, repoKey, type GithubPaginatedCursor } from "./github-utils";
import { batchInsertGithubIssue, getLatestGithubIssueUpdate } from "../db/queries";
import type { GithubIssueInsert } from "../db/schema";

const STEP = "github-sync-issues";

export const syncGithubIssuesStep = async (incremental: boolean = false, db: SqliteDb, cursor?: GithubPaginatedCursor) => {
  let token: string;
  let repos: GithubRepoRef[];
  try {
    token = await getGithubToken(db);
    repos = reposFromCursor(await getConfiguredRepos(db), cursor?.repo);
  } catch (e) {
    await upsertSyncTask({ integration: "github", status: "FAILED", step: STEP, inputs: { error: String(e) } }, db);
    return;
  }

  const since = incremental ? await getLatestGithubIssueUpdate(db) : null;

  for (const { owner, repo } of repos) {
    const key = repoKey(owner, repo);
    let url: string | null =
      cursor?.repo === key && cursor.url
        ? cursor.url
        : `/repos/${owner}/${repo}/issues?state=all&per_page=100&direction=desc&sort=updated${since ? `&since=${encodeURIComponent(since)}` : ""}`;

    while (url) {
      const pageUrl = url;
      try {
        const res = await githubFetch(pageUrl, token);
        if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
        const issues = (await res.json()) as GithubIssue[];
        const next: string | null = nextLink(res);

        // Filter out PRs (they surface on the issues endpoint too).
        const realIssues = issues.filter((i) => !i.pull_request);

        const rows: GithubIssueInsert[] = [];
        for (const issue of realIssues) {
          const comments = await fetchComments(owner, repo, issue.number, token);
          rows.push({
            artifactId: `${owner}/${repo}#issue-${issue.number}`,
            repo: key,
            number: issue.number,
            title: issue.title,
            body: issue.body,
            state: issue.state,
            author: issue.user?.login ?? null,
            labels: issue.labels.map((l) => l.name),
            comments,
            htmlUrl: issue.html_url,
            createdAt: issue.created_at,
            updatedAt: issue.updated_at,
          });
        }
        await batchInsertGithubIssue(rows, db);

        const nextCursor: GithubPaginatedCursor | null = next ? { repo: key, url: next } : null;
        await upsertSyncTask({
          integration: "github",
          status: "SUCCESS",
          step: STEP,
          inputs: nextCursor ? { repo: key, count: rows.length, cursor: nextCursor } : { repo: key, count: rows.length },
        }, db);
        url = next;
        if (cursor) break;
      } catch (e) {
        await upsertSyncTask({
          integration: "github",
          status: "FAILED",
          step: STEP,
          inputs: { repo: key, cursor: { repo: key, url: pageUrl }, error: String(e) },
        }, db);
        break;
      }
    }
    if (cursor) break;
  }
};

const fetchComments = async (owner: string, repo: string, number: number, token: string): Promise<StoredComment[]> => {
  const all: StoredComment[] = [];
  let url: string | null = `/repos/${owner}/${repo}/issues/${number}/comments?per_page=100`;
  while (url) {
    const res = await githubFetch(url, token);
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
    const comments = (await res.json()) as GithubComment[];
    all.push(...comments.map((c) => ({ author: c.user?.login ?? null, body: c.body, createdAt: c.created_at })));
    url = nextLink(res);
  }
  return all;
};
