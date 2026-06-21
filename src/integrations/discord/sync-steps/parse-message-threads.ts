import { getLastArtifactDateByIntegration, upsertMdArtifact } from "@/core/db/queries/queries";
import { getDiscordChannels, getDiscordThreadIds, getMessageTimestampRangeByChannelId, getTopLevelMessagesByChannelId } from "../db/queries";
import type { DiscordChannelSelect, DiscordMessageSelect } from "../db/schema";
import { MAX_WORKERS, PAGE_SIZE, SUMMARIZATION_MODEL } from "@/lib/constants";
import { retry } from "@/lib/utils";
import { generateText, Output } from "ai";
import * as z from "zod";

export const parseDiscordMessages = async (incremental: boolean): Promise<void> => {
  const lastArtifactDate = await getLastArtifactDateByIntegration("discord");
  await parseChannelMessages(incremental, lastArtifactDate);
  await parseThreadMessages(incremental, lastArtifactDate);
}

const parseThreadMessages = async (incremental: boolean, lastArtifactDate?: string) => {
  let curOffset = 0;
  let threadArray: { threadId: string; lastMessageDate: string }[] = await getDiscordThreadIds(curOffset);

  while (threadArray.length > 0) {
    let curIndex = 0;
    while (curIndex < threadArray.length) {
      let workerQueue: { threadId: string; lastMessageDate: string }[] = [];
      while (workerQueue.length <= MAX_WORKERS && curIndex < threadArray.length) {
        if (!incremental) {
          workerQueue.push(threadArray[curIndex]!);
        } else if (lastArtifactDate && lastArtifactDate < threadArray[curIndex]!.lastMessageDate) {
          workerQueue.push(threadArray[curIndex]!);
        }
        curIndex += 1;
      }
      await Promise.all(workerQueue.map((threadObj) => {
        processMessages(true, threadObj.threadId,
          (new Date(threadObj.lastMessageDate)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          threadObj.lastMessageDate
        );
      }));
    }
    curOffset += PAGE_SIZE;
    threadArray = await getDiscordThreadIds(curOffset);
  }
}

const parseChannelMessages = async (incremental: boolean, lastArtifactDate: string | undefined) => {
  let curOffset = 0;
  let channels: DiscordChannelSelect[] = await getDiscordChannels(curOffset);

  while (channels.length > 0) {
    for (const channel of channels) {
      const range = await getMessageTimestampRangeByChannelId(channel.id)
      if (!range) continue;

      const dayArray = constructDayMap(new Date(range.minMessageTimestamp), new Date(range.maxMessageTimestamp));
      let curDayIndex = 0;

      while (curDayIndex < dayArray.length) {
        const workDays: { [day: string]: { start: string, end: string } }[] = [];
        while (workDays.length <= MAX_WORKERS && curDayIndex < dayArray.length) {
          const dayObj = dayArray[curDayIndex];
          if (dayObj) {
            if (!incremental || (lastArtifactDate && Object.values(dayObj)[0]!.start >= lastArtifactDate)) {
              workDays.push(dayObj);
            }
          }
          curDayIndex += 1;
        }
        await Promise.all(workDays.map((dayObj) => {
          const readableDay = Object.keys(dayObj)[0]!
          const day = dayObj[readableDay]!
          processMessages(false, channel.id, readableDay, day.start, day.end);
        }));
      }
    }
    curOffset += PAGE_SIZE;
    channels = await getDiscordChannels(curOffset);
  }
}

const processMessages = async (thread: boolean, channelId: string, readableDate: string, start: string, end?: string) => {
  let markdown = "";
  let messages: DiscordMessageSelect[] = [];

  if (!thread && end) {
    messages = await getTopLevelMessagesByChannelId(channelId, end, start);
    markdown = `# Messages for ${readableDate}\n---\n`;
  } else {
    messages = [];
    markdown = `# Messages for thread: ${channelId}`
  }

  for (const message of messages) {
    markdown += `${message.author} - ${message.timestamp}: ${message.content}\n---\n`
  }

  const analysisPrompt = `Analyze the following Discord conversation and extract three distinct types of information:

1. KEY POINTS: The main takeaways, important decisions, and key ideas discussed.
2. QUESTIONS ANSWERED: The key questions or problems this conversation addresses and resolves.
3. ENTITIES: Names of people, companies, tools, products, concepts, and other important entities mentioned.

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
    integrationArtifactId: `${channelId}-${readableDate}`,
    integration: "discord",
    artifactDate: start,
    markdown,
    keyPoints: analysis.keyPoints,
    questionsAnswered: analysis.questionsAnswered,
    entities: analysis.entities,
  });
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
