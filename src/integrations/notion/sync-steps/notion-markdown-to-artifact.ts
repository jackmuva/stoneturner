import { MAX_WORKERS, PAGE_SIZE, SUMMARIZATION_MODEL } from "@/lib/constants";
import type { NotionPageSelect } from "../db/schema";
import { getNotionPageMarkdownById, getNotionPages } from "../db/queries";
import { getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { generateText, Output } from "ai";
import * as z from "zod";

export const notionMarkdownToArtifact = async (incremental?: { lastEditedDate: string | null }, cursor?: number) => {
  let curOffset: number = cursor ? cursor : 0;
  let notionPages: NotionPageSelect[] = await getNotionPages(curOffset);

  while (notionPages.length > 0) {
    let notionPageIndex = 0;
    while (notionPageIndex < notionPages.length) {
      let workerQueue: NotionPageSelect[] = [];
      while (workerQueue.length < MAX_WORKERS && notionPageIndex < notionPages.length) {
        if (incremental && incremental.lastEditedDate) {
          if (notionPages[notionPageIndex]?.lastEditedTime && notionPages[notionPageIndex]!.lastEditedTime! >= incremental.lastEditedDate) {
            workerQueue.push(notionPages[notionPageIndex]!);
          }
        } else {
          workerQueue.push(notionPages[notionPageIndex]!);
        }
        notionPageIndex += 1;
      }
      try {
        const results = await Promise.allSettled(workerQueue.map((page) => analyzePageMarkdown(page)));

        const failures = results
          .filter((r) => r.status === "rejected")
          .map((r) => String((r as PromiseRejectedResult).reason));

        await upsertSyncTask({
          integration: "notion",
          status: failures.length ? "FAILED" : "SUCCESS",
          step: "notion-markdown-to-artifact",
          inputs: failures.length ? { cursor: curOffset, errors: failures } : { cursor: curOffset },
        })
      } catch (e) {
        await upsertSyncTask({
          integration: "notion",
          status: "FAILED",
          step: "notion-markdown-to-artifact",
          inputs: { cursor: curOffset, error: e },
        })
      }
    }
    if (cursor !== undefined) break;
    curOffset += PAGE_SIZE;
    notionPages = await getNotionPages(curOffset);
  }
}

const analyzePageMarkdown = async (page: NotionPageSelect): Promise<void> => {
  const pageMarkdown = await getNotionPageMarkdownById(page.pageId);
  if (!pageMarkdown?.markdown) return;

  const existing = await getMdArtifactByIntegrationArtifactId(page.pageId);
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
  }), 3, 1);

  await upsertMdArtifact({
    integrationArtifactId: page.pageId,
    integration: "notion",
    artifactDate: page.lastEditedTime,
    markdown: "# " + page.title + "\n" + pageMarkdown.markdown,
    keyPoints: analysis.keyPoints,
    questionsAnswered: analysis.questionsAnswered,
    entities: analysis.entities,
  });
}
