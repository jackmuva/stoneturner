import { getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { PAGE_SIZE, SUMMARIZATION_MODEL } from "@/lib/constants";
import { generateText, Output } from "ai";
import * as z from "zod";
import { aiGatewayBottleneck } from "@/core/services/rate-limiter";
import { getFirecrawlPages } from "../db/queries";
import type { FirecrawlPageSelect } from "../db/schema";
import type { SqliteDb } from "@/core/models/db-models";

export const parseFirecrawlStep = async (db: SqliteDb, offset?: number): Promise<void> => {
  let curOffset: number = offset ?? 0;
  let pages: FirecrawlPageSelect[] = [];
  let firstIteration = true;

  while (pages.length > 0 || firstIteration) {
    firstIteration = false;
    try {
      pages = await getFirecrawlPages(curOffset, db);
      const results = await Promise.allSettled(
        pages.map((p) => aiGatewayBottleneck.schedule(() => generateMdArtifact(p, db)))
      );
      const failures = results
        .filter((r) => r.status === "rejected")
        .map((r) => String((r as PromiseRejectedResult).reason));

      await upsertSyncTask({
        integration: "Firecrawl",
        status: failures.length ? "FAILED" : "SUCCESS",
        inputs: failures.length ? { offset: curOffset, errors: failures } : { offset: curOffset },
        step: "parse",
      }, db);
    } catch (e) {
      await upsertSyncTask({
        integration: "Firecrawl",
        status: "FAILED",
        inputs: { offset: curOffset, error: String(e) },
        step: "parse",
      }, db);
    }

    if (offset !== undefined) {
      break;
    } else {
      curOffset += PAGE_SIZE;
    }
  }
}

const generateMdArtifact = async (page: FirecrawlPageSelect, db: SqliteDb): Promise<void> => {
  const md: string[] = [];
  if (page.title) md.push(`# ${page.title}\n\n`);
  md.push(`Source: ${page.url}\n\n`);
  md.push(page.markdown ?? "");
  const markdown: string = md.join("");

  const existing = await getMdArtifactByIntegrationArtifactId(page.url, db);
  if (existing && existing.markdown === markdown) return;

  const { output: analysis } = await retry(async () => await generateText({
    model: SUMMARIZATION_MODEL,
    prompt: `Analyze the following web page content and extract three distinct types of information:

1. KEY POINTS: The main takeaways, important concepts, and key ideas presented on the page.
2. QUESTIONS ANSWERED: The key questions or problems this page addresses and resolves.
3. ENTITIES: Names of people, companies, tools, papers, products, concepts, and other important entities mentioned.

For each category, provide a comprehensive list with clear, concise entries.

Page content:
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
    integrationArtifactId: page.url,
    integration: "Firecrawl",
    artifactDate: page.crawledAt ?? undefined,
    markdown,
    keyPoints: analysis.keyPoints,
    questionsAnswered: analysis.questionsAnswered,
    entities: analysis.entities,
  }, db);
}
