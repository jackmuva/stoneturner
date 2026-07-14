import type { SqliteDb } from "@/core/models/db-models";
import { getGithubDiscussions, getGithubDocs, getGithubIssues, getGithubSourceFiles } from "../db/queries";
import type { GithubDiscussionSelect, GithubDocSelect, GithubIssueSelect, GithubSourceFileSelect } from "../db/schema";
import { parseTable, renderComments } from "./parse-utils";
import type { GithubParseTableInputs } from "./github-utils";
import { getGithubPulls } from "../db/queries";
import type { GithubPullSelect } from "../db/schema";
import type { StoredPullFile, StoredReviewComment } from "../models/models";

const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", mjs: "javascript", cjs: "javascript",
  mts: "typescript", cts: "typescript", py: "python", go: "go", rs: "rust", java: "java", rb: "ruby",
  php: "php", c: "c", cpp: "cpp", h: "c", hpp: "cpp", cs: "csharp", swift: "swift", kt: "kotlin",
  scala: "scala", vue: "vue", svelte: "svelte", json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
  css: "css", scss: "scss", less: "less", sql: "sql",
};

const renderSourceFile = (row: GithubSourceFileSelect): string => {
  const path = row.path;
  if (row.isMarkdown) {
    return `# File: ${path}\n\n${row.content ?? ""}`;
  }
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const lang = LANGUAGE_BY_EXT[ext] ?? "";
  return `# File: ${path}\n\n\`\`\`${lang}\n${row.content ?? ""}\n\`\`\``;
};

export const parseGithubCodeStep = async (_incremental: boolean, db: SqliteDb, inputs?: GithubParseTableInputs, syncTaskId?: string) => {
  await parseTable("github-parse-code", (o) => getGithubSourceFiles(o, db),
    renderSourceFile, () => null, db, inputs, syncTaskId);
};

const renderDiscussion = (row: GithubDiscussionSelect): string => {
  const category = row.category ? `\n**Category:** ${row.category}` : "";
  return `# Discussion #${row.number}: ${row.title ?? ""}

**Repository:** ${row.repo}${category}
**URL:** ${row.url ?? ""}

${row.body ?? ""}${renderComments(row.comments)}`;
};

export const parseGithubDiscussionsStep = async (_incremental: boolean, db: SqliteDb, inputs?: GithubParseTableInputs, syncTaskId?: string) => {
  await parseTable("github-parse-discussions", (o) => getGithubDiscussions(o, db), renderDiscussion, (r) => r.createdAt, db, inputs, syncTaskId);
};

const renderDoc = (row: GithubDocSelect): string => {
  return `# ${row.repo} — ${row.path}

${row.content ?? ""}`;
};

export const parseGithubDocsStep = async (_incremental: boolean, db: SqliteDb, inputs?: GithubParseTableInputs, syncTaskId?: string) => {
  await parseTable("github-parse-docs", (o) => getGithubDocs(o, db),
    renderDoc, () => null, db, inputs, syncTaskId);
};

const renderIssue = (row: GithubIssueSelect): string => {
  const labels = row.labels && row.labels.length ? `\n\n**Labels:** ${row.labels.join(", ")}` : "";
  return `# Issue #${row.number}: ${row.title ?? ""}

**Repository:** ${row.repo}
**State:** ${row.state ?? ""}
**Author:** ${row.author ?? "unknown"}
**URL:** ${row.htmlUrl ?? ""}${labels}

${row.body ?? ""}${renderComments(row.comments)}`;
};

export const parseGithubIssuesStep = async (_incremental: boolean, db: SqliteDb, inputs?: GithubParseTableInputs, syncTaskId?: string) => {
  await parseTable("github-parse-issues", (o) => getGithubIssues(o, db), renderIssue,
    (r) => r.updatedAt ?? r.createdAt, db, inputs, syncTaskId);
};

const renderPullFiles = (files: StoredPullFile[] | null): string => {
  if (!files || files.length === 0) return "";
  return "\n\n## Changed Files\n\n" + files.map((f) => {
    const header = `### ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})`;
    const patch = f.patch ? `\n\n\`\`\`diff\n${f.patch}\n\`\`\`` : "";
    return header + patch;
  }).join("\n\n");
};

const renderReviewComments = (comments: StoredReviewComment[] | null): string => {
  if (!comments || comments.length === 0) return "";
  return "\n\n## Review Comments\n\n" + comments.map((c) =>
    `**${c.author ?? "unknown"}** on \`${c.path}\` (${c.createdAt}):${c.diffHunk ? `\n\n\`\`\`diff\n${c.diffHunk}\n\`\`\`` : ""}\n\n${c.body ?? ""}`,
  ).join("\n\n---\n\n");
};

const renderPull = (row: GithubPullSelect): string => {
  return `# Pull Request #${row.number}: ${row.title ?? ""}

**Repository:** ${row.repo}
**State:** ${row.state ?? ""}
**Author:** ${row.author ?? "unknown"}
**URL:** ${row.htmlUrl ?? ""}

${row.body ?? ""}${renderPullFiles(row.files)}${renderReviewComments(row.reviewComments)}`;
};

export const parseGithubPullsStep = async (_incremental: boolean, db: SqliteDb, inputs?: GithubParseTableInputs, syncTaskId?: string) => {
  await parseTable("github-parse-pulls", (o) => getGithubPulls(o, db), renderPull,
    (r) => r.updatedAt ?? r.createdAt, db, inputs, syncTaskId);
};
