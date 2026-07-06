import { getLastArtifactDateByIntegration, getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import { withSyncTaskId } from "@/core/services/retry-cron";
import {
  getMessagesByThreadTs,
  getMessageTimestampRangeByChannelId,
  getSlackChannelById,
  getSlackChannels,
  getSlackThreadParents,
  getSlackUserById,
  getTopLevelMessagesByChannelId,
} from "../db/queries";
import type { SlackChannelSelect, SlackMessageSelect } from "../db/schema";
import { PAGE_SIZE, SUMMARIZATION_MODEL } from "@/lib/constants";
import { retry } from "@/lib/utils";
import { generateText, Output } from "ai";
import * as z from "zod";
import { aiGatewayBottleneck } from "@/core/services/rate-limiter";
import { slackTsToIso } from "./slack-utils";
import type { SqliteDb } from "@/core/models/db-models";

export type SlackParseChannelCursor = {
  thread: false;
  channelId: string;
  readableDate: string;
  start: string;
  end?: string;
};

export type SlackParseThreadCursor = {
  thread: true;
  channelId: string;
  threadTs: string;
};

export type SlackParseCursor = SlackParseChannelCursor | SlackParseThreadCursor;

export const parseSlackMessages = async (
  incremental: boolean,
  db: SqliteDb,
  cursor?: SlackParseCursor,
  syncTaskId?: string,
): Promise<void> => {
  const lastArtifactDate = await getLastArtifactDateByIntegration("slack", db);
  if (cursor?.thread) {
    await parseThreadMessages(incremental, db, lastArtifactDate, cursor, syncTaskId);
  } else if (cursor) {
    await parseChannelMessages(incremental, db, lastArtifactDate, cursor, syncTaskId);
  } else {
    await parseChannelMessages(incremental, db, lastArtifactDate, undefined, syncTaskId);
    await parseThreadMessages(incremental, db, lastArtifactDate, undefined, syncTaskId);
  }
};

const parseThreadMessages = async (
  incremental: boolean,
  db: SqliteDb,
  lastArtifactDate?: string,
  cursor?: SlackParseThreadCursor,
  syncTaskId?: string,
) => {
  let offset = 0;
  while (true) {
    const threads = await getSlackThreadParents(offset, db);
    if (threads.length === 0) break;

    let workerQueue = threads.filter((thread) =>
      !incremental || (lastArtifactDate !== undefined && (thread.latestReply ?? thread.threadTs) >= lastArtifactDate)
    );
    if (cursor) {
      workerQueue = workerQueue.filter(
        (thread) => thread.channelId === cursor.channelId && thread.threadTs === cursor.threadTs,
      );
    }

    await Promise.allSettled(workerQueue.map((thread) =>
      aiGatewayBottleneck.schedule(async () => {
        const channel = await getSlackChannelById(thread.channelId, db);
        const messages = await getMessagesByThreadTs(thread.channelId, thread.threadTs, db);
        return processMessages(
          channel?.name ?? thread.channelId,
          messages,
          db,
          { thread: true, channelId: thread.channelId, threadTs: thread.threadTs },
          syncTaskId,
        );
      })
    ));

    if (cursor) break;
    if (threads.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
};

const parseChannelMessages = async (
  incremental: boolean,
  db: SqliteDb,
  lastArtifactDate: string | undefined,
  cursor?: SlackParseChannelCursor,
  syncTaskId?: string,
) => {
  let offset = 0;
  let channels: SlackChannelSelect[] = await getSlackChannels(offset, db);

  while (channels.length > 0) {
    for (const channel of channels) {
      if (cursor && channel.id !== cursor.channelId) continue;

      const range = await getMessageTimestampRangeByChannelId(channel.id, db);
      if (!range?.minMessageTimestamp || !range.maxMessageTimestamp) continue;

      let dayArray = constructDayMap(
        new Date(Number.parseFloat(range.minMessageTimestamp) * 1000),
        new Date(Number.parseFloat(range.maxMessageTimestamp) * 1000),
      );

      if (cursor && dayArray) {
        dayArray = dayArray.filter((day) => day[Object.keys(day)[0]!]?.start === cursor.start);
      }

      const workDays = dayArray.filter((dayObj) =>
        !incremental || (lastArtifactDate !== undefined && Object.values(dayObj)[0]!.start >= lastArtifactDate)
      );

      await Promise.allSettled(workDays.map((dayObj) =>
        aiGatewayBottleneck.schedule(async () => {
          const readableDay = Object.keys(dayObj)[0]!;
          const day = dayObj[readableDay]!;
          const afterTs = (new Date(day.start).getTime() / 1000).toFixed(6);
          const beforeTs = (new Date(day.end).getTime() / 1000).toFixed(6);
          const messages = await getTopLevelMessagesByChannelId(channel.id, beforeTs, afterTs, db);
          return processMessages(
            channel.name,
            messages,
            db,
            {
              thread: false,
              channelId: channel.id,
              readableDate: readableDay,
              start: day.start,
              end: day.end,
            },
            syncTaskId,
          );
        })
      ));

      if (cursor) return;
    }
    offset += PAGE_SIZE;
    channels = await getSlackChannels(offset, db);
  }
};

const formatUser = async (userId: string | null, db: SqliteDb): Promise<string> => {
  if (!userId) return "unknown";
  const user = await getSlackUserById(userId, db);
  if (!user) return userId;
  const display = user.displayName || user.realName || user.name;
  return `${display} (@${user.name})`;
};

const processMessages = async (
  channelName: string,
  messages: SlackMessageSelect[],
  db: SqliteDb,
  resumeInputs: SlackParseCursor,
  syncTaskId?: string,
) => {
  try {
    if (messages.length === 0) return;

    let markdown = "";
    if (resumeInputs.thread) {
      const parentText = messages.find((m) => m.ts === resumeInputs.threadTs)?.text ?? "Thread";
      markdown = `# Thread in #${channelName}: ${parentText}\n---\n`;
    } else {
      markdown = `# Messages for #${channelName} ${resumeInputs.readableDate}\n---\n`;
    }

    for (const message of messages) {
      const author = await formatUser(message.userId, db);
      markdown += `${author} - ${slackTsToIso(message.ts)}: ${message.text}\n---\n`;
    }

    const artifactId = resumeInputs.thread
      ? `${resumeInputs.channelId}-${resumeInputs.threadTs}`
      : `${resumeInputs.channelId}-${resumeInputs.readableDate}`;
    const artifactDate = resumeInputs.thread
      ? slackTsToIso(resumeInputs.threadTs)
      : resumeInputs.start;

    const existing = await getMdArtifactByIntegrationArtifactId(artifactId, db);
    if (existing && existing.markdown === markdown) return;

    const analysisPrompt = `Analyze the following Slack conversation and extract three distinct types of information:

1. keyPoints: The main takeaways, important decisions, and key ideas discussed.
2. questionsAnswered: The key questions or problems this conversation addresses and resolves.
3. entities: Names of people, companies, tools, products, concepts, and other important entities mentioned.

For each category, provide a comprehensive list with clear, concise entries.

Conversation:
${markdown}`;

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
      integrationArtifactId: artifactId,
      integration: "slack",
      artifactDate,
      markdown,
      keyPoints: analysis.keyPoints,
      questionsAnswered: analysis.questionsAnswered,
      entities: analysis.entities,
    }, db);

    await upsertSyncTask(withSyncTaskId({
      integration: "slack",
      status: "SUCCESS",
      inputs: resumeInputs,
      step: "slack-parse-messages",
    }, syncTaskId), db);
  } catch (e) {
    await upsertSyncTask(withSyncTaskId({
      integration: "slack",
      status: "FAILED",
      inputs: resumeInputs,
      error: String(e),
      step: "slack-parse-messages",
    }, syncTaskId), db);
  }
};

const constructDayMap = (firstDate: Date, lastDate: Date) => {
  const dayArray: { [day: string]: { start: string; end: string } }[] = [];

  const cur = new Date(firstDate);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(lastDate);
  end.setHours(0, 0, 0, 0);

  while (cur <= end) {
    const dayStart = new Date(cur);
    const dayEnd = new Date(cur);
    dayEnd.setHours(23, 59, 59, 999);
    dayArray.push({
      [cur.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })]: {
        start: dayStart.toISOString(),
        end: dayEnd.toISOString(),
      },
    });
    cur.setDate(cur.getDate() + 1);
  }
  return dayArray;
};
