import { getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { PAGE_SIZE, SUMMARIZATION_MODEL } from "@/lib/constants";
import { generateText, Output } from "ai";
import * as z from "zod";
import { aiGatewayBottleneck } from "@/core/services/rate-limiter";
import type { SqliteDb } from "@/core/models/db-models";
import { getGmailMessages } from "../db/queries";
import type { GmailMessageSelect } from "../db/schema";

export const parseGmailStep = async (db: SqliteDb, offset?: number): Promise<void> => {
  let curOffset: number = offset ?? 0;
  let messages: GmailMessageSelect[] = [];
  let firstIteration = true;

  while (messages.length > 0 || firstIteration) {
    firstIteration = false;
    try {
      messages = await getGmailMessages(curOffset, db);
      const results = await Promise.allSettled(
        messages.map((m) => aiGatewayBottleneck.schedule(() => generateMdArtifact(m, db))),
      );
      const failures = results
        .filter((r) => r.status === "rejected")
        .map((r) => String((r as PromiseRejectedResult).reason));

      await upsertSyncTask({
        integration: "gmail",
        status: failures.length ? "FAILED" : "SUCCESS",
        inputs: failures.length ? { offset: curOffset, errors: failures } : { offset: curOffset },
        step: "parse",
      }, db);
    } catch (e) {
      await upsertSyncTask({
        integration: "gmail",
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
};

const renderMarkdown = (message: GmailMessageSelect): string => {
  const md: string[] = [];
  md.push(`# ${message.subject || "(no subject)"}\n\n`);
  if (message.fromAddress) md.push(`**From:** ${message.fromAddress}\n\n`);
  if (message.toAddress) md.push(`**To:** ${message.toAddress}\n\n`);
  if (message.ccAddress) md.push(`**Cc:** ${message.ccAddress}\n\n`);
  if (message.dateHeader) md.push(`**Date:** ${message.dateHeader}\n\n`);
  if (message.labelIds?.length) md.push(`**Labels:** ${message.labelIds.join(", ")}\n\n`);
  md.push(message.bodyText || message.snippet || "");
  return md.join("");
};

const generateMdArtifact = async (message: GmailMessageSelect, db: SqliteDb): Promise<void> => {
  const markdown = renderMarkdown(message);

  const existing = await getMdArtifactByIntegrationArtifactId(message.messageId, db);
  if (existing && existing.markdown === markdown) return;

  const { output: analysis } = await retry(async () => await generateText({
    model: SUMMARIZATION_MODEL,
    prompt: `Analyze the following email and extract three distinct types of information:

1. KEY POINTS: The main takeaways, important concepts, and key ideas in the email.
2. QUESTIONS ANSWERED: The key questions or problems this email addresses and resolves.
3. ENTITIES: Names of people, companies, tools, products, concepts, and other important entities mentioned.

For each category, provide a comprehensive list with clear, concise entries.

Email:
${markdown}`,
    output: Output.object({
      schema: z.object({
        keyPoints: z.array(z.string()),
        questionsAnswered: z.array(z.string()),
        entities: z.array(z.string()),
      }),
    }),
  }), 3, 1);

  const artifactDate = message.internalDate
    ? new Date(Number(message.internalDate)).toISOString()
    : message.dateHeader ?? undefined;

  await upsertMdArtifact({
    integrationArtifactId: message.messageId,
    integration: "gmail",
    artifactDate,
    markdown,
    keyPoints: analysis.keyPoints,
    questionsAnswered: analysis.questionsAnswered,
    entities: analysis.entities,
  }, db);
};
