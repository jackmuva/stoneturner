import { getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { PAGE_SIZE, SUMMARIZATION_MODEL } from "@/lib/constants";
import { generateText, Output } from "ai";
import * as z from "zod";
import { aiGatewayBottleneck } from "@/core/services/rate-limiter";
import type { SqliteDb } from "@/core/models/db-models";
import { getTwitterTweets } from "../db/queries";
import type { TwitterTweetSelect } from "../db/schema";
import type { TwitterPublicMetrics } from "../models/models";

const sourceLabel: Record<string, string> = {
  tweet: "Post",
  mention: "Mention",
  bookmark: "Bookmark",
};

const formatMetrics = (metrics: TwitterPublicMetrics | null | undefined): string => {
  if (!metrics) return "";
  const parts: string[] = [];
  if (metrics.like_count != null) parts.push(`Likes: ${metrics.like_count}`);
  if (metrics.retweet_count != null) parts.push(`Reposts: ${metrics.retweet_count}`);
  if (metrics.reply_count != null) parts.push(`Replies: ${metrics.reply_count}`);
  if (metrics.quote_count != null) parts.push(`Quotes: ${metrics.quote_count}`);
  if (metrics.bookmark_count != null) parts.push(`Bookmarks: ${metrics.bookmark_count}`);
  return parts.length ? `\n\n**Engagement:** ${parts.join(" · ")}` : "";
};

const renderTweetMarkdown = (row: TwitterTweetSelect): string => {
  const label = sourceLabel[row.source] ?? "Tweet";
  const author = row.authorUsername
    ? `@${row.authorUsername}${row.authorName ? ` (${row.authorName})` : ""}`
    : row.authorName ?? "Unknown author";

  const refs = row.referencedTweets?.length
    ? `\n\n**References:** ${row.referencedTweets.map((r) => `${r.type} ${r.id}`).join(", ")}`
    : "";

  return `# ${label} — ${author}

**Date:** ${row.createdAt ?? "unknown"}
**URL:** ${row.url ?? ""}${formatMetrics(row.publicMetrics)}${refs}

${row.text}`;
};

export const parseTwitterStep = async (db: SqliteDb, offset?: number): Promise<void> => {
  let curOffset = offset ?? 0;
  let rows: TwitterTweetSelect[] = [];
  let firstIteration = true;

  while (rows.length > 0 || firstIteration) {
    firstIteration = false;
    try {
      rows = await getTwitterTweets(curOffset, db);
      const results = await Promise.allSettled(
        rows.map((row) => aiGatewayBottleneck.schedule(() => generateMdArtifact(row, db))),
      );
      const failures = results
        .filter((r) => r.status === "rejected")
        .map((r) => String((r as PromiseRejectedResult).reason));

      await upsertSyncTask({
        integration: "twitter",
        status: failures.length ? "FAILED" : "SUCCESS",
        inputs: failures.length ? { offset: curOffset, errors: failures } : { offset: curOffset },
        step: "parse",
      }, db);
    } catch (e) {
      await upsertSyncTask({
        integration: "twitter",
        status: "FAILED",
        inputs: { offset: curOffset, error: String(e) },
        step: "parse",
      }, db);
    }

    if (offset !== undefined) break;
    curOffset += PAGE_SIZE;
  }
};

const generateMdArtifact = async (row: TwitterTweetSelect, db: SqliteDb): Promise<void> => {
  const markdown = renderTweetMarkdown(row);

  const existing = await getMdArtifactByIntegrationArtifactId(row.tweetId, db);
  if (existing && existing.markdown === markdown) return;

  const { output: analysis } = await retry(async () => await generateText({
    model: SUMMARIZATION_MODEL,
    prompt: `Analyze the following X (Twitter) post and extract three distinct types of information:

1. KEY POINTS: The main takeaways, important concepts, and key ideas in the post.
2. QUESTIONS ANSWERED: The key questions or problems this post addresses and resolves.
3. ENTITIES: Names of people, companies, tools, products, concepts, and other important entities mentioned.

For each category, provide a comprehensive list with clear, concise entries.

Post:
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
    integrationArtifactId: row.tweetId,
    integration: "twitter",
    artifactDate: row.createdAt ?? undefined,
    markdown,
    keyPoints: analysis.keyPoints,
    questionsAnswered: analysis.questionsAnswered,
    entities: analysis.entities,
  }, db);
};
