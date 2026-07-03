import { getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";
import { retry } from "@/lib/utils";
import { PAGE_SIZE, SUMMARIZATION_MODEL } from "@/lib/constants";
import { generateText, Output } from "ai";
import * as z from "zod";
import { aiGatewayBottleneck } from "@/core/services/rate-limiter";
import {
  getGithubIssues, getGithubPulls, getGithubDocs, getGithubDiscussions, getGithubSourceFiles,
} from "../db/queries";
import type {
  GithubIssueSelect, GithubPullSelect, GithubDocSelect, GithubDiscussionSelect, GithubSourceFileSelect,
} from "../db/schema";
import type { StoredComment, StoredPullFile, StoredReviewComment } from "../models/models";

const STEP = "parse";

export const parseGithubStep = async (db: SqliteDb) => {
  await parseTable("github-parse-issues", (o) => getGithubIssues(o, db), renderIssue, (r) => r.updatedAt ?? r.createdAt, db);
  await parseTable("github-parse-pulls", (o) => getGithubPulls(o, db), renderPull, (r) => r.updatedAt ?? r.createdAt, db);
  await parseTable("github-parse-docs", (o) => getGithubDocs(o, db), renderDoc, () => null, db);
  await parseTable("github-parse-discussions", (o) => getGithubDiscussions(o, db), renderDiscussion, (r) => r.createdAt, db);
  await parseTable("github-parse-code", (o) => getGithubSourceFiles(o, db), renderSourceFile, () => null, db);
};

type Artifactable = { artifactId: string };

// Generic pager: walk a raw table, render each row to markdown, extract insights
// via the summarization LLM (through the shared bottleneck), and upsert.
const parseTable = async <T extends Artifactable>(
  stepLabel: string,
  getRows: (offset: number) => Promise<T[]>,
  render: (row: T) => string,
  getDate: (row: T) => string | null,
  db: SqliteDb,
) => {
  let offset = 0;
  let rows = await getRows(offset);

  while (rows.length > 0) {
    try {
      const results = await Promise.allSettled(
        rows.map((row) => aiGatewayBottleneck.schedule(() => generateArtifact(row, render, getDate, db))),
      );
      const failures = results.filter((r) => r.status === "rejected").map((r) => String((r as PromiseRejectedResult).reason));
      await upsertSyncTask({
        integration: "github",
        status: failures.length ? "FAILED" : "SUCCESS",
        step: STEP,
        inputs: failures.length ? { stepLabel, offset, errors: failures } : { stepLabel, offset },
      }, db);
    } catch (e) {
      await upsertSyncTask({ integration: "github", status: "FAILED", step: STEP, inputs: { stepLabel, offset, error: String(e) } }, db);
    }
    offset += PAGE_SIZE;
    rows = await getRows(offset);
  }
};

const generateArtifact = async <T extends Artifactable>(
  row: T,
  render: (row: T) => string,
  getDate: (row: T) => string | null,
  db: SqliteDb,
): Promise<void> => {
  const markdown = render(row);

  const existing = await getMdArtifactByIntegrationArtifactId(row.artifactId, db);
  if (existing && existing.markdown === markdown) return;

  const { output: analysis } = await retry(async () => await generateText({
    model: SUMMARIZATION_MODEL,
    prompt: `Analyze the following GitHub content and extract three distinct types of information:

1. keyPoints: The main takeaways, decisions, problems, and key ideas.
2. questionsAnswered: The key questions or problems this content addresses.
3. entities: Names of people, repositories, files, tools, products, and concepts mentioned.

For each category, provide a comprehensive list with clear, concise entries.

Content:
${markdown}`,
    output: Output.object({
      schema: z.object({
        keyPoints: z.array(z.string()),
        questionsAnswered: z.array(z.string()),
        entities: z.array(z.string()),
      }),
    }),
  }), 3, 1);

  await upsertMdArtifact({
    integrationArtifactId: row.artifactId,
    integration: "github",
    artifactDate: getDate(row),
    markdown,
    keyPoints: analysis.keyPoints,
    questionsAnswered: analysis.questionsAnswered,
    entities: analysis.entities,
  }, db);
};

// ---- Markdown renderers ----

const renderComments = (comments: StoredComment[] | null): string => {
  if (!comments || comments.length === 0) return "";
  return "\n\n## Comments\n\n" + comments
    .map((c) => `**${c.author ?? "unknown"}** (${c.createdAt}):\n\n${c.body ?? ""}`)
    .join("\n\n---\n\n");
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

const renderDoc = (row: GithubDocSelect): string => {
  return `# ${row.repo} — ${row.path}

${row.content ?? ""}`;
};

const renderDiscussion = (row: GithubDiscussionSelect): string => {
  const category = row.category ? `\n**Category:** ${row.category}` : "";
  return `# Discussion #${row.number}: ${row.title ?? ""}

**Repository:** ${row.repo}${category}
**URL:** ${row.url ?? ""}

${row.body ?? ""}${renderComments(row.comments)}`;
};

const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", mjs: "javascript", cjs: "javascript",
  mts: "typescript", cts: "typescript", py: "python", go: "go", rs: "rust", java: "java", rb: "ruby",
  php: "php", c: "c", cpp: "cpp", h: "c", hpp: "cpp", cs: "csharp", swift: "swift", kt: "kotlin",
  scala: "scala", vue: "vue", svelte: "svelte", json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
  css: "css", scss: "scss", less: "less", sql: "sql",
};

const renderSourceFile = (row: GithubSourceFileSelect): string => {
  const path = row.path;
  // Markdown files render inline; everything else in a fenced code block.
  if (row.isMarkdown) {
    return `# File: ${path}\n\n${row.content ?? ""}`;
  }
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const lang = LANGUAGE_BY_EXT[ext] ?? "";
  return `# File: ${path}\n\n\`\`\`${lang}\n${row.content ?? ""}\n\`\`\``;
};
