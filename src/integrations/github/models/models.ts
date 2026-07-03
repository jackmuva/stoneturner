// TypeScript types for the GitHub REST + GraphQL API responses we consume.

export type GithubRepoRef = {
  owner: string;
  repo: string;
};

export type GithubUser = {
  login: string;
} | null;

export type GithubLabel = {
  name: string;
};

// GET /repos/{owner}/{repo}
export type GithubRepoInfo = {
  default_branch: string;
};

// GET /repos/{owner}/{repo}/issues (PRs are filtered out via `pull_request`)
export type GithubIssue = {
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: GithubLabel[];
  user: GithubUser;
  html_url: string;
  created_at: string;
  updated_at: string;
  pull_request?: unknown;
};

// GET /repos/{owner}/{repo}/issues/{number}/comments
// (also reused for PR issue-comments shape)
export type GithubComment = {
  body: string | null;
  user: GithubUser;
  created_at: string;
};

// GET /repos/{owner}/{repo}/pulls
export type GithubPull = {
  number: number;
  title: string;
  body: string | null;
  state: string;
  user: GithubUser;
  html_url: string;
  created_at: string;
  updated_at: string;
};

// GET /repos/{owner}/{repo}/pulls/{number}/files
export type GithubPullFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
};

// GET /repos/{owner}/{repo}/pulls/{number}/comments
export type GithubReviewComment = {
  path: string;
  body: string | null;
  user: GithubUser;
  diff_hunk?: string;
  created_at: string;
};

// GET /repos/{owner}/{repo}/contents/{path}
export type GithubContentEntry = {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
  sha: string;
  size: number;
  download_url: string | null;
};

// GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1
export type GithubTreeEntry = {
  path: string;
  sha: string;
  type: "blob" | "tree" | "commit";
  mode: string;
  size?: number;
};

export type GithubTreeResponse = {
  sha: string;
  tree: GithubTreeEntry[];
  truncated: boolean;
};

// POST /graphql — Discussions
export type GithubDiscussionComment = {
  body: string | null;
  createdAt: string;
  author: GithubUser;
};

export type GithubDiscussionNode = {
  number: number;
  title: string;
  body: string | null;
  url: string;
  createdAt: string;
  category: { name: string } | null;
  comments: { nodes: GithubDiscussionComment[] };
};

export type GithubDiscussionsResponse = {
  data?: {
    repository: {
      discussions: {
        nodes: GithubDiscussionNode[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      } | null;
    } | null;
  };
  errors?: unknown;
};

// Denormalized shapes stored as JSON on our raw tables.
export type StoredComment = {
  author: string | null;
  body: string | null;
  createdAt: string;
};

export type StoredPullFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string | null;
};

export type StoredReviewComment = {
  path: string;
  author: string | null;
  body: string | null;
  diffHunk: string | null;
  createdAt: string;
};
