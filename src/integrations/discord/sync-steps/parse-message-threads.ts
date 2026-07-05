import { getLastArtifactDateByIntegration, getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import { withSyncTaskId } from "@/integrations/retry-step-utils";
import { getDiscordChannelById, getDiscordChannels, getDiscordThreadIds, getMessagesByThreadId, getMessageTimestampRangeByChannelId, getTopLevelMessagesByChannelId } from "../db/queries";
import type { DiscordChannelSelect, DiscordMessageSelect } from "../db/schema";
import { PAGE_SIZE, SUMMARIZATION_MODEL } from "@/lib/constants";
import { retry } from "@/lib/utils";
import { generateText, Output } from "ai";
import * as z from "zod";
import { aiGatewayBottleneck } from "@/core/services/rate-limiter";
import type { SqliteDb } from "@/core/models/db-models";

export const parseDiscordMessages = async (
  incremental: boolean,
  db: SqliteDb,
  cursor?: { thread: boolean, channelId: string, readableDate: string, start: string, end?: string },
  syncTaskId?: string,
): Promise<void> => {
  const lastArtifactDate = await getLastArtifactDateByIntegration("discord", db);
  if (cursor?.thread) {
    await parseThreadMessages(incremental, db, lastArtifactDate, cursor, syncTaskId);
  } else if (cursor) {
    await parseChannelMessages(incremental, db, lastArtifactDate, cursor, syncTaskId);
  } else {
    await parseChannelMessages(incremental, db, lastArtifactDate, undefined, syncTaskId);
    await parseThreadMessages(incremental, db, lastArtifactDate, undefined, syncTaskId);
  }
}

const parseThreadMessages = async (
  incremental: boolean,
  db: SqliteDb,
  lastArtifactDate?: string,
  cursor?: { thread: boolean, channelId: string, readableDate: string, start: string, end?: string },
  syncTaskId?: string,
) => {
  let curOffset = 0;
  let threadArray: { channelId: string, threadId: string; lastMessageDate: string }[] = await getDiscordThreadIds(curOffset, db);

  while (threadArray.length > 0) {
    let workerQueue = threadArray.filter((threadObj) =>
      !incremental || (lastArtifactDate !== undefined && lastArtifactDate < threadObj.lastMessageDate)
    );
    if (cursor) workerQueue = workerQueue.filter((work) => work.channelId === cursor.channelId);

    await Promise.allSettled(workerQueue.map((threadObj) =>
      aiGatewayBottleneck.schedule(async () => {
        const channel = await getDiscordChannelById(threadObj.channelId, db);
        return processMessages(true, threadObj.threadId, channel?.name ?? threadObj.channelId,
          (new Date(threadObj.lastMessageDate)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          threadObj.lastMessageDate, db, undefined, syncTaskId,
        )
      })
    ));

    curOffset += PAGE_SIZE;
    threadArray = await getDiscordThreadIds(curOffset, db);
  }
}

const parseChannelMessages = async (
  incremental: boolean,
  db: SqliteDb,
  lastArtifactDate: string | undefined,
  cursor?: { thread: boolean, channelId: string, readableDate: string, start: string, end?: string },
  syncTaskId?: string,
) => {
  let curOffset = 0;
  let channels: DiscordChannelSelect[] = await getDiscordChannels(curOffset, db);

  while (channels.length > 0) {
    for (const channel of channels) {
      if (cursor && channel.id !== cursor.channelId) continue;

      const range = await getMessageTimestampRangeByChannelId(channel.id, db)
      if (!range || !range.minMessageTimestamp || !range.maxMessageTimestamp) continue;

      let dayArray = constructDayMap(new Date(range.minMessageTimestamp), new Date(range.maxMessageTimestamp));

      if (cursor && dayArray) dayArray = dayArray.filter((day) => day[Object.keys(day)[0]!]?.start === cursor.start);

      const workDays = dayArray.filter((dayObj) =>
        !incremental || (lastArtifactDate !== undefined && Object.values(dayObj)[0]!.start >= lastArtifactDate)
      );

      await Promise.allSettled(workDays.map((dayObj) =>
        aiGatewayBottleneck.schedule(() => {
          const readableDay = Object.keys(dayObj)[0]!
          const day = dayObj[readableDay]!
          return processMessages(false, channel.id, channel?.name ?? channel.id, readableDay, day.start, db, day.end, syncTaskId);
        })
      ));
    }
    curOffset += PAGE_SIZE;
    channels = await getDiscordChannels(curOffset, db);
  }
}

const processMessages = async (thread: boolean, channelId: string, channelName: string, readableDate: string, start: string, db: SqliteDb, end?: string, syncTaskId?: string) => {
  try {
    let markdown = "";
    let messages: DiscordMessageSelect[] = [];

    if (!thread && end) {
      messages = await getTopLevelMessagesByChannelId(channelId, end, start, db);
      markdown = `# Messages for ${channelName} ${readableDate}\n---\n`;
    } else {
      messages = await getMessagesByThreadId(channelId, db);
      markdown = `# Messages for thread: ${channelName}\n---\n`
    }

    for (const message of messages) {
      markdown += `${message.author.username ?? message.author.global_name ?? message.author.id} - ${message.timestamp}: ${message.content}\n---\n`
    }

    const artifactId = `${channelId}-${readableDate}`;
    const existing = await getMdArtifactByIntegrationArtifactId(artifactId, db);
    if (existing && existing.markdown === markdown) return;

    const analysisPrompt = `Analyze the following Discord conversation and extract three distinct types of information:

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
      integration: "discord",
      artifactDate: start,
      markdown,
      keyPoints: analysis.keyPoints,
      questionsAnswered: analysis.questionsAnswered,
      entities: analysis.entities,
    }, db);

    await upsertSyncTask(withSyncTaskId({
      integration: "discord",
      status: "SUCCESS",
      inputs: JSON.stringify({ thread, channelId, readableDate, start, end }),
      step: "discord-parse-messages",
    }, syncTaskId), db);
  } catch (e) {
    await upsertSyncTask(withSyncTaskId({
      integration: "discord",
      status: "FAILED",
      inputs: JSON.stringify({ thread, channelId, readableDate, start, end }),
      error: String(e),
      step: "discord-parse-messages",
    }, syncTaskId), db);
  }
}

const constructDayMap = (firstDate: Date, lastDate: Date) => {
  const dayArray: { [day: string]: { start: string, end: string } }[] = [];

  let cur = new Date(firstDate)
  cur.setHours(0, 0, 0, 0)
  const end = new Date(lastDate)
  end.setHours(0, 0, 0, 0)

  while (cur <= end) {
    const dayStart = new Date(cur)
    const dayEnd = new Date(cur)
    dayEnd.setHours(23, 59, 59, 999)
    dayArray.push({
      [cur.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })]: {
        start: dayStart.toISOString(),
        end: dayEnd.toISOString(),
      }
    });
    cur.setDate(cur.getDate() + 1)
  }
  return dayArray;
}
