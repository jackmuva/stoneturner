import { PAGE_SIZE, SUMMARIZATION_MODEL } from "@/lib/constants";
import type { NotionPageSelect } from "../db/schema";
import { getNotionPageMarkdownById, getNotionPages } from "../db/queries";
import { getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import { withSyncTaskId } from "@/integrations/retry-step-utils";
import type { SqliteDb } from "@/core/models/db-models";
import { retry } from "@/lib/utils";
import { generateText, Output } from "ai";
import * as z from "zod";
import { aiGatewayBottleneck } from "@/core/services/rate-limiter";

export const notionMarkdownToArtifact = async (db: SqliteDb, incremental?: { lastEditedDate: string | null }, cursor?: number, syncTaskId?: string) => {
  let curOffset: number = cursor ? cursor : 0;
  let notionPages: NotionPageSelect[] = await getNotionPages(curOffset, db);

  while (notionPages.length > 0) {
    const workerQueue = notionPages.filter((page) =>
      !incremental || !incremental.lastEditedDate ||
      (page.lastEditedTime !== null && page.lastEditedTime >= incremental.lastEditedDate)
    );
    try {
      const results = await Promise.allSettled(
        workerQueue.map((page) => aiGatewayBottleneck.schedule(() => analyzePageMarkdown(page, db)))
      );

      const failures = results
        .filter((r) => r.status === "rejected")
        .map((r) => String((r as PromiseRejectedResult).reason));

      await upsertSyncTask(withSyncTaskId({
        integration: "notion",
        status: failures.length ? "FAILED" : "SUCCESS",
        step: "notion-markdown-to-artifact",
        inputs: { cursor: curOffset },
        error: failures.length ? JSON.stringify(failures) : undefined,
      }, syncTaskId), db)
    } catch (e) {
      await upsertSyncTask(withSyncTaskId({
        integration: "notion",
        status: "FAILED",
        step: "notion-markdown-to-artifact",
        inputs: { cursor: curOffset },
        error: String(e),
      }, syncTaskId), db)
    }
    if (cursor !== undefined) break;
    curOffset += PAGE_SIZE;
    notionPages = await getNotionPages(curOffset, db);
  }
}

const analyzePageMarkdown = async (page: NotionPageSelect, db: SqliteDb): Promise<void> => {
  const pageMarkdown = await getNotionPageMarkdownById(page.pageId, db);
  if (!pageMarkdown?.markdown) return;

  const existing = await getMdArtifactByIntegrationArtifactId(page.pageId, db);
  if (existing && existing.markdown === pageMarkdown.markdown) return;

  const analysisPrompt = `Analyze the following Notion page content and extract three distinct types of information:

1. keyPoints: The main takeaways, important decisions, and key ideas documented.
2. questionsAnswered: The key questions or problems this page addresses and resolves.
3. entities: Names of people, companies, tools, products, concepts, and other important entities mentioned.

For each category, provide a comprehensive list with clear, concise entries.

Notion page content:
${"# " + page.title + "\n" + pageMarkdown.markdown}`;

  const { output: analysis } = await retry(async () => await generateText({
    model: SUMMARIZATION_MODEL,
    prompt: analysisPrompt,
    output: Output.object({
      schema: z.object({
        keyPoints: z.array(z.string()),
        questionsAnswered: z.array(z.string()),
        entities: z.array(z.string()),
      }),
    }),
  }));

  await upsertMdArtifact({
    integrationArtifactId: page.pageId,
    integration: "notion",
    artifactDate: page.lastEditedTime,
    markdown: "# " + page.title + "\n" + pageMarkdown.markdown,
    keyPoints: analysis.keyPoints,
    questionsAnswered: analysis.questionsAnswered,
    entities: analysis.entities,
  }, db);
}
