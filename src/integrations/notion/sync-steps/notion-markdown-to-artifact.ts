import { getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import { PAGE_SIZE, SUMMARIZATION_MODEL } from "@/lib/constants";
import type { NotionPageSelect } from "../db/schema";
import { getNotionPageMarkdownById, getNotionPages, getMostRecentEditedTime } from "../db/queries";
import type { SqliteDb } from "@/core/models/db-models";
import { retry } from "@/lib/utils";
import { generateText, Output } from "ai";
import * as z from "zod";
import { aiGatewayBottleneck } from "@/core/services/rate-limiter";

export type NotionMarkdownToArtifactInputs = { offset?: number };

export const notionMarkdownToArtifact = async (incremental: boolean = false, db: SqliteDb, inputs?: NotionMarkdownToArtifactInputs, syncTaskId?: string) => {
  const lastEditedDate = incremental ? await getMostRecentEditedTime(db) : null;
  const offset = inputs?.offset;
  let curOffset: number = offset ?? 0;
  let notionPages: NotionPageSelect[] = await getNotionPages(curOffset, db);

  while (notionPages.length > 0) {
    const workerQueue = notionPages.filter((page) =>
      !incremental || !lastEditedDate ||
      (page.lastEditedTime !== null && page.lastEditedTime >= lastEditedDate)
    );
    try {
      const results = await Promise.allSettled(
        workerQueue.map((page) => aiGatewayBottleneck.schedule(() => analyzePageMarkdown(page, db)))
      );

      const failures = results
        .filter((r) => r.status === "rejected")
        .map((r) => String((r as PromiseRejectedResult).reason));

      await upsertSyncTask({
        id: syncTaskId,
        integration: "notion",
        status: failures.length ? "FAILED" : "SUCCESS",
        step: "notion-markdown-to-artifact",
        inputs: { offset: curOffset },
        error: failures.length ? JSON.stringify(failures) : null,
      }, db)
    } catch (e) {
      await upsertSyncTask({
        id: syncTaskId,
        integration: "notion",
        status: "FAILED",
        step: "notion-markdown-to-artifact",
        inputs: { offset: curOffset },
        error: String(e),
      }, db)
    }
    if (offset !== undefined) break;
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
