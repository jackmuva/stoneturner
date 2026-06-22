import { getLastArtifactDateByIntegration, getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import { getDiscordChannelById, getDiscordChannels, getDiscordThreadIds, getMessagesByThreadId, getMessageTimestampRangeByChannelId, getTopLevelMessagesByChannelId } from "../db/queries";
import type { DiscordChannelSelect, DiscordMessageSelect } from "../db/schema";
import { MAX_WORKERS, PAGE_SIZE, SUMMARIZATION_MODEL } from "@/lib/constants";
import { retry } from "@/lib/utils";
import { generateText, Output } from "ai";
import * as z from "zod";

export const parseDiscordMessages = async (
  incremental: boolean,
  cursor?: { thread: boolean, channelId: string, readableDate: string, start: string, end?: string }
): Promise<void> => {
  const lastArtifactDate = await getLastArtifactDateByIntegration("discord");
  if (cursor?.thread) {
    await parseThreadMessages(incremental, lastArtifactDate, cursor);
  } else if (cursor) {
    await parseChannelMessages(incremental, lastArtifactDate, cursor);
  } else {
    await parseChannelMessages(incremental, lastArtifactDate);
    await parseThreadMessages(incremental, lastArtifactDate);
  }
}

const parseThreadMessages = async (
  incremental: boolean,
  lastArtifactDate?: string,
  cursor?: { thread: boolean, channelId: string, readableDate: string, start: string, end?: string }
) => {
  let curOffset = 0;
  let threadArray: { channelId: string, threadId: string; lastMessageDate: string }[] = await getDiscordThreadIds(curOffset);

  while (threadArray.length > 0) {
    let curIndex = 0;
    while (curIndex < threadArray.length) {
      let { workerQueue, newIndex } = fillWorkerQueue(incremental, threadArray, curIndex, lastArtifactDate)
      curIndex = newIndex;
      if (cursor) workerQueue = workerQueue.filter((work) => work.channelId === cursor.channelId);
      await Promise.allSettled(workerQueue.map(async (threadObj) => {
        const channel = await getDiscordChannelById(threadObj.channelId);
        return processMessages(true, threadObj.threadId, channel?.name ?? threadObj.channelId,
          (new Date(threadObj.lastMessageDate)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          threadObj.lastMessageDate
        )
      }));
    }
    curOffset += PAGE_SIZE;
    threadArray = await getDiscordThreadIds(curOffset);
  }
}

const fillWorkerQueue = (
  incremental: boolean,
  threadArray: { channelId: string, threadId: string; lastMessageDate: string }[],
  lastIndex: number,
  lastArtifactDate?: string,
) => {
  let curIndex = lastIndex;
  let workerQueue: { channelId: string, threadId: string; lastMessageDate: string }[] = [];
  while (workerQueue.length < MAX_WORKERS && curIndex < threadArray.length) {
    if (!incremental) {
      workerQueue.push(threadArray[curIndex]!);
    } else if (lastArtifactDate && lastArtifactDate < threadArray[curIndex]!.lastMessageDate) {
      workerQueue.push(threadArray[curIndex]!);
    }
    curIndex += 1;
  }
  return { workerQueue, newIndex: curIndex };
}

const parseChannelMessages = async (
  incremental: boolean,
  lastArtifactDate: string | undefined,
  cursor?: { thread: boolean, channelId: string, readableDate: string, start: string, end?: string }
) => {
  let curOffset = 0;
  let channels: DiscordChannelSelect[] = await getDiscordChannels(curOffset);

  while (channels.length > 0) {
    for (const channel of channels) {
      if (cursor && channel.id !== cursor.channelId) continue;

      const range = await getMessageTimestampRangeByChannelId(channel.id)
      if (!range || !range.minMessageTimestamp || !range.maxMessageTimestamp) continue;

      let dayArray = constructDayMap(new Date(range.minMessageTimestamp), new Date(range.maxMessageTimestamp));

      if (cursor && dayArray) dayArray = dayArray.filter((day) => day[Object.keys(day)[0]!]?.start === cursor.start);

      let curDayIndex = 0;

      while (curDayIndex < dayArray.length) {
        const { workDays, newIndex } = fillWorkDays(incremental, curDayIndex, dayArray, lastArtifactDate);
        curDayIndex = newIndex;

        await Promise.allSettled(workDays.map((dayObj) => {
          const readableDay = Object.keys(dayObj)[0]!
          const day = dayObj[readableDay]!
          return processMessages(false, channel.id, channel?.name ?? channel.id, readableDay, day.start, day.end);
        }));
      }
    }
    curOffset += PAGE_SIZE;
    channels = await getDiscordChannels(curOffset);
  }
}

const fillWorkDays = (
  incremental: boolean,
  existingIndex: number,
  dayArray: {
    [day: string]: {
      start: string;
      end: string;
    };
  }[],
  lastArtifactDate?: string,
) => {
  let curDayIndex = existingIndex;
  const workDays: { [day: string]: { start: string, end: string } }[] = [];
  while (workDays.length < MAX_WORKERS && curDayIndex < dayArray.length) {
    const dayObj = dayArray[curDayIndex];
    if (dayObj) {
      if (!incremental || (lastArtifactDate && Object.values(dayObj)[0]!.start >= lastArtifactDate)) {
        workDays.push(dayObj);
      }
    }
    curDayIndex += 1;
  }
  return { workDays, newIndex: curDayIndex };
}

const processMessages = async (thread: boolean, channelId: string, channelName: string, readableDate: string, start: string, end?: string) => {
  try {
    let markdown = "";
    let messages: DiscordMessageSelect[] = [];

    if (!thread && end) {
      messages = await getTopLevelMessagesByChannelId(channelId, end, start);
      markdown = `# Messages for ${channelName} ${readableDate}\n---\n`;
    } else {
      messages = await getMessagesByThreadId(channelId);
      markdown = `# Messages for thread: ${channelName}\n---\n`
    }

    for (const message of messages) {
      markdown += `${message.author.username ?? message.author.global_name ?? message.author.id} - ${message.timestamp}: ${message.content}\n---\n`
    }

    const artifactId = `${channelId}-${readableDate}`;
    const existing = await getMdArtifactByIntegrationArtifactId(artifactId);
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
    }), 3, 1);

    await upsertMdArtifact({
      integrationArtifactId: artifactId,
      integration: "discord",
      artifactDate: start,
      markdown,
      keyPoints: analysis.keyPoints,
      questionsAnswered: analysis.questionsAnswered,
      entities: analysis.entities,
    });

    await upsertSyncTask({
      integration: "discord",
      status: "SUCCESS",
      inputs: JSON.stringify({ thread, channelId, readableDate, start, end }),
      step: "discord-parse-messages",
    });
  } catch (e) {
    await upsertSyncTask({
      integration: "discord",
      status: "FAILED",
      inputs: JSON.stringify({ thread, channelId, readableDate, start, end }),
      step: "discord-parse-messages",
    });
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
