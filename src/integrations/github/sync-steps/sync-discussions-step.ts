import { upsertSyncTask } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";
import type { GithubDiscussionsResponse, GithubRepoRef, StoredComment } from "../models/models";
import { GITHUB_API, githubApiBottleneck, getConfiguredRepos, getGithubToken, reposFromCursor, repoKey, type GithubDiscussionsCursor } from "./github-utils";
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

export const syncGithubDiscussionsStep = async (_incremental: boolean = false, db: SqliteDb, cursor?: GithubDiscussionsCursor) => {
  let token: string;
  let repos: GithubRepoRef[];
  try {
    token = await getGithubToken(db);
    repos = reposFromCursor(await getConfiguredRepos(db), cursor?.repo);
  } catch (e) {
    await upsertSyncTask({ integration: "github", status: "FAILED", step: STEP, inputs: { error: String(e) } }, db);
    return;
  }

  for (const { owner, repo } of repos) {
    const key = repoKey(owner, repo);
    let pageCursor: string | null = cursor?.repo === key ? (cursor.cursor ?? null) : null;
    let hasNext = true;

    while (hasNext) {
      try {
        const body = await graphql(owner, repo, pageCursor, token);
        // Discussions may be disabled for a repo — errors/null repository.
        const discussions = body.data?.repository?.discussions;
        if (!discussions) {
          if (body.errors) {
            await upsertSyncTask({ integration: "github", status: "FAILED", step: STEP, inputs: { repo: key, errors: body.errors } }, db);
          }
          break;
        }

        const rows: GithubDiscussionInsert[] = discussions.nodes.map((d) => ({
          artifactId: `${owner}/${repo}#discussion-${d.number}`,
          repo: key,
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

        hasNext = discussions.pageInfo.hasNextPage;
        const nextCursor: GithubDiscussionsCursor | null = hasNext
          ? { repo: key, cursor: discussions.pageInfo.endCursor }
          : null;
        await upsertSyncTask({
          integration: "github",
          status: "SUCCESS",
          step: STEP,
          inputs: nextCursor ? { repo: key, count: rows.length, cursor: nextCursor } : { repo: key, count: rows.length },
        }, db);

        pageCursor = discussions.pageInfo.endCursor;
        if (cursor) break;
      } catch (e) {
        await upsertSyncTask({
          integration: "github",
          status: "FAILED",
          step: STEP,
          inputs: { repo: key, cursor: { repo: key, cursor: pageCursor }, error: String(e) },
        }, db);
        break;
      }
    }
    if (cursor) break;
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
