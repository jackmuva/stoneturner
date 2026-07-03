import { upsertSyncTask } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";
import type { GithubDiscussionsResponse, GithubRepoRef, StoredComment } from "../models/models";
import { GITHUB_API, githubApiBottleneck, getConfiguredRepos, getGithubToken } from "./github-utils";
import { retry } from "@/lib/utils";
import { batchInsertGithubDiscussion } from "../db/queries";
import type { GithubDiscussionInsert } from "../db/schema";

const STEP = "github-sync-discussions";

const DISCUSSIONS_QUERY = `query($owner: String!, $repo: String!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    discussions(first: 100, after: $cursor) {
      nodes {
        number
        title
        body
        url
        createdAt
        category { name }
        comments(first: 50) {
          nodes { body createdAt author { login } }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

export const syncGithubDiscussionsStep = async (_incremental: boolean = false, db: SqliteDb) => {
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
    let cursor: string | null = null;
    let hasNext = true;

    while (hasNext) {
      try {
        const body = await graphql(owner, repo, cursor, token);
        // Discussions may be disabled for a repo — errors/null repository.
        const discussions = body.data?.repository?.discussions;
        if (!discussions) {
          if (body.errors) {
            await upsertSyncTask({ integration: "github", status: "FAILED", step: STEP, inputs: { repo: `${owner}/${repo}`, errors: body.errors } }, db);
          }
          break;
        }

        const rows: GithubDiscussionInsert[] = discussions.nodes.map((d) => ({
          artifactId: `${owner}/${repo}#discussion-${d.number}`,
          repo: `${owner}/${repo}`,
          number: d.number,
          title: d.title,
          body: d.body,
          category: d.category?.name ?? null,
          author: null,
          url: d.url,
          comments: d.comments.nodes.map((c): StoredComment => ({ author: c.author?.login ?? null, body: c.body, createdAt: c.createdAt })),
          createdAt: d.createdAt,
        }));
        await batchInsertGithubDiscussion(rows, db);

        await upsertSyncTask({ integration: "github", status: "SUCCESS", step: STEP, inputs: { repo: `${owner}/${repo}`, count: rows.length } }, db);

        hasNext = discussions.pageInfo.hasNextPage;
        cursor = discussions.pageInfo.endCursor;
      } catch (e) {
        await upsertSyncTask({ integration: "github", status: "FAILED", step: STEP, inputs: { repo: `${owner}/${repo}`, cursor, error: String(e) } }, db);
        break;
      }
    }
  }
};

const graphql = async (owner: string, repo: string, cursor: string | null, token: string): Promise<GithubDiscussionsResponse> => {
  return await githubApiBottleneck.schedule(() =>
    retry(async () => {
      const res = await fetch(`${GITHUB_API}/graphql`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "stoneturner",
        },
        body: JSON.stringify({ query: DISCUSSIONS_QUERY, variables: { owner, repo, cursor } }),
      });
      if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}: ${await res.text()}`);
      return (await res.json()) as GithubDiscussionsResponse;
    }),
  );
};
