import { MAX_WORKERS, PAGE_SIZE, SUMMARIZATION_MODEL } from "@/lib/constants";
import type { NotionPageSelect } from "../db/schema";
import { getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import { getNotionBlockById, getNotionPages } from "../db/queries";
import { retry } from "@/lib/utils";
import { generateText, Output } from "ai";
import * as z from "zod";

export const notionToMarkdown = async (incremental?: { lastEditedDate: string | null }, cursor?: number) => {
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
        const markdownResults = await Promise.allSettled(workerQueue.map((page) => {
          return traverseBlockTree(page.pageId);
        }));
        const markdownObj = markdownResults.map((promiseRes, i) => {
          return { workerI: i, value: promiseRes.status === "fulfilled" ? promiseRes.value : null }
        }).filter((obj) => obj.value);


        await Promise.allSettled(markdownObj.map(async (obj) => {
          const artifactId = workerQueue[obj.workerI]!.pageId;
          const existing = await getMdArtifactByIntegrationArtifactId(artifactId);
          if (existing && existing.markdown === obj.value) return;

          const analysisPrompt = `Analyze the following Notion page content and extract three distinct types of information:

1. keyPoints: The main takeaways, important decisions, and key ideas documented.
2. questionsAnswered: The key questions or problems this page addresses and resolves.
3. entities: Names of people, companies, tools, products, concepts, and other important entities mentioned.

For each category, provide a comprehensive list with clear, concise entries.

Notion page content:
${obj.value}`;

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
            integrationArtifactId: artifactId,
            integration: "notion",
            artifactDate: workerQueue[obj.workerI]?.lastEditedTime,
            markdown: obj.value,
            keyPoints: analysis.keyPoints,
            questionsAnswered: analysis.questionsAnswered,
            entities: analysis.entities,
          });


        }));

        upsertSyncTask({
          integration: "notion",
          status: "SUCCESS",
          step: "notion-to-markdown",
          inputs: { cursor: curOffset },
        })
      } catch (e) {
        upsertSyncTask({
          integration: "notion",
          status: "FAILED",
          step: "notion-to-markdown",
          inputs: { cursor: curOffset, error: e },
        })
      }
    }
    if (cursor) break;
    curOffset += PAGE_SIZE;
    notionPages = await getNotionPages(curOffset);
  }
}

const traverseBlockTree = async (blockId: string): Promise<string> => {
  const block = await getNotionBlockById(blockId);
  if (!block) return "";
  let res = block.text ?? "";
  if (!block || !block.childrenBlockIds || block.childrenBlockIds.length === 0) return res;
  for (const childBlock of block.childrenBlockIds) {
    res += await traverseBlockTree(childBlock);
  }
  return res;
}
