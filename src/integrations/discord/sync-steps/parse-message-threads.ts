import { getLastArtifactDateByIntegration, getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import { getDiscordChannelById, getDiscordChannels, getDiscordThreadIds, getMessagesByThreadId, getMessageTimestampRangeByChannelId, getTopLevelMessagesByChannelId } from "../db/queries";
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
  let threadArray: { channelId: string, threadId: string; lastMessageDate: string }[] = await getDiscordThreadIds(curOffset);

  while (threadArray.length > 0) {
    let curIndex = 0;
    while (curIndex < threadArray.length) {
      let workerQueue: { channelId: string, threadId: string; lastMessageDate: string }[] = [];
      while (workerQueue.length < MAX_WORKERS && curIndex < threadArray.length) {
        if (!incremental) {
          workerQueue.push(threadArray[curIndex]!);
        } else if (lastArtifactDate && lastArtifactDate < threadArray[curIndex]!.lastMessageDate) {
          workerQueue.push(threadArray[curIndex]!);
        }
        curIndex += 1;
      }
      const threadResults = await Promise.allSettled(workerQueue.map(async(threadObj) => {
        const channel = await getDiscordChannelById(threadObj.channelId);
        return processMessages(true, threadObj.threadId, channel?.name ?? threadObj.channelId,
          (new Date(threadObj.lastMessageDate)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          threadObj.lastMessageDate
        )
      }));
      for (const result of threadResults) {
        if (result.status === 'rejected') {
          console.error('Failed to process thread:', result.reason);
        }
      }
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
        while (workDays.length < MAX_WORKERS && curDayIndex < dayArray.length) {
          const dayObj = dayArray[curDayIndex];
          if (dayObj) {
            if (!incremental || (lastArtifactDate && Object.values(dayObj)[0]!.start >= lastArtifactDate)) {
              workDays.push(dayObj);
            }
          }
          curDayIndex += 1;
        }
        const dayResults = await Promise.allSettled(workDays.map((dayObj) => {
          const readableDay = Object.keys(dayObj)[0]!
          const day = dayObj[readableDay]!
          return processMessages(false, channel.id, channel?.name ?? channel.id, readableDay, day.start, day.end);
        }));
        for (const result of dayResults) {
          if (result.status === 'rejected') {
            console.error('Failed to process channel day:', result.reason);
          }
        }
      }
    }
    curOffset += PAGE_SIZE;
    channels = await getDiscordChannels(curOffset);
  }
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
      inputs: JSON.stringify({ thread, channelId, readableDate }),
      step: "parse-discord-messages",
    });
  } catch (e) {
    await upsertSyncTask({
      integration: "discord",
      status: "FAILED",
      inputs: JSON.stringify({ thread, channelId, readableDate }),
      step: "parse-discord-messages",
    });
    throw e;
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
