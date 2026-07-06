import { getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import { withSyncTaskId } from "@/core/services/retry-cron";
import type { SqliteDb } from "@/core/models/db-models";
import { retry } from "@/lib/utils";
import { PAGE_SIZE, SUMMARIZATION_MODEL } from "@/lib/constants";
import { generateText, Output } from "ai";
import * as z from "zod";
import { aiGatewayBottleneck } from "@/core/services/rate-limiter";
import type { StoredComment } from "../models/models";

export const PARSE_STEP = "parse";

type Artifactable = { artifactId: string };

export const renderComments = (comments: StoredComment[] | null): string => {
  if (!comments || comments.length === 0) return "";
  return "\n\n## Comments\n\n" + comments
    .map((c) => `**${c.author ?? "unknown"}** (${c.createdAt}):\n\n${c.body ?? ""}`)
    .join("\n\n---\n\n");
};

export const parseTable = async <T extends Artifactable>(
  stepLabel: string,
  getRows: (offset: number) => Promise<T[]>,
  render: (row: T) => string,
  getDate: (row: T) => string | null,
  db: SqliteDb,
  offset?: number,
  syncTaskId?: string,
) => {
  let curOffset = offset ?? 0;
  let rows = await getRows(curOffset);

  while (rows.length > 0) {
    try {
      const results = await Promise.allSettled(
        rows.map((row) => aiGatewayBottleneck.schedule(() => generateArtifact(row, render, getDate, db))),
      );
      const failures = results.filter((r) => r.status === "rejected").map((r) => String((r as PromiseRejectedResult).reason));
      const nextCursor = { offset: curOffset + PAGE_SIZE };
      await upsertSyncTask(withSyncTaskId({
        integration: "github",
        status: failures.length ? "FAILED" : "SUCCESS",
        step: PARSE_STEP,
        inputs: failures.length
          ? { stepLabel, cursor: { offset: curOffset } }
          : { stepLabel, cursor: nextCursor },
        error: failures.length ? JSON.stringify(failures) : undefined,
      }, syncTaskId), db);
    } catch (e) {
      await upsertSyncTask(withSyncTaskId({
        integration: "github",
        status: "FAILED",
        step: PARSE_STEP,
        inputs: { stepLabel, cursor: { offset: curOffset } },
        error: String(e),
      }, syncTaskId), db);
    }
    if (offset !== undefined) break;
    curOffset += PAGE_SIZE;
    rows = await getRows(curOffset);
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
  }));

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
