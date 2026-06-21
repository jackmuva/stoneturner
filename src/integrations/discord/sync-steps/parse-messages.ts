// import { getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
// import { retry } from "@/lib/utils";
// import {
//   getThreadChannels,
//   getNonThreadChannels,
//   getMessagesByChannelId,
//   getTopLevelMessagesByChannelId,
//   getChannelById,
//   getGuildById,
// } from "../db/queries";
// import type { DiscordChannelSelect, DiscordMessageSelect } from "../db/schema";
// import type { User } from "../models/models";
// import { PAGE_SIZE, SUMMARIZATION_MODEL, MAX_WORKERS } from "@/lib/constants";
// import { generateText, Output } from "ai";
// import * as z from "zod";
//
// const MESSAGE_CAP = 200;
//
// const formatAuthor = (author: User): string => {
//   return author.global_name ?? author.username;
// };
//
// const formatTimestamp = (ts: string): string => {
//   return new Date(ts).toISOString().replace("T", " ").slice(0, 19);
// };
//
// const buildMessageLine = (msg: DiscordMessageSelect): string => {
//   const author = formatAuthor(msg.author);
//   const ts = formatTimestamp(msg.timestamp);
//   let line = `**${author}** — ${ts}`;
//
//   if (msg.referencedMessageId) {
//     line += ` -> replying to ${msg.referencedMessageId}`;
//   }
//
//   line += `\n${msg.content}`;
//
//   return line;
// };
//
// const buildThreadMarkdown = (
//   thread: DiscordChannelSelect,
//   parentChannel: DiscordChannelSelect | undefined,
//   guildName: string | undefined,
//   messages: DiscordMessageSelect[],
// ): string => {
//   const md: string[] = [];
//   md.push(`# ${thread.name ?? thread.id}\n`);
//
//   const headerParts: string[] = [];
//   headerParts.push(`**Guild:** ${guildName ?? "unknown"}`);
//   if (parentChannel) {
//     headerParts.push(`**Parent channel:** ${parentChannel.name ?? parentChannel.id}`);
//   }
//   if (thread.topic) {
//     headerParts.push(`**Topic:** ${thread.topic}`);
//   }
//   if (thread.threadMetadata) {
//     if (thread.threadMetadata.archived) headerParts.push("Archived");
//     if (thread.threadMetadata.locked) headerParts.push("Locked");
//   }
//   md.push(headerParts.join(" | "));
//   md.push("\n---\n");
//
//   for (const msg of messages) {
//     md.push(buildMessageLine(msg));
//     md.push("\n\n");
//   }
//
//   return md.join("");
// };
//
// const buildChannelDayMarkdown = (
//   channel: DiscordChannelSelect,
//   guildName: string | undefined,
//   date: string,
//   messages: DiscordMessageSelect[],
// ): string => {
//   const md: string[] = [];
//   md.push(`# ${channel.name ?? channel.id} — ${date}\n`);
//
//   const headerParts: string[] = [];
//   headerParts.push(`**Guild:** ${guildName ?? "unknown"}`);
//   headerParts.push(`**Channel:** ${channel.name ?? channel.id}`);
//   if (channel.topic) {
//     headerParts.push(`**Topic:** ${channel.topic}`);
//   }
//   md.push(headerParts.join(" | "));
//   md.push("\n---\n");
//
//   for (const msg of messages) {
//     md.push(buildMessageLine(msg));
//     md.push("\n\n");
//   }
//
//   return md.join("");
// };
//
// const groupByDate = (messages: DiscordMessageSelect[]): Map<string, DiscordMessageSelect[]> => {
//   const groups = new Map<string, DiscordMessageSelect[]>();
//   for (const msg of messages) {
//     const date = msg.timestamp.slice(0, 10);
//     const existing = groups.get(date);
//     if (existing) {
//       existing.push(msg);
//     } else {
//       groups.set(date, [msg]);
//     }
//   }
//   return groups;
// };
//
// const generateArtifact = async (
//   integrationArtifactId: string,
//   markdown: string,
//   artifactDate: string | undefined | null,
// ): Promise<void> => {
//   const existing = await getMdArtifactByIntegrationArtifactId(integrationArtifactId);
//   if (existing && existing.markdown === markdown) {
//     return;
//   }
//
//   const analysisPrompt = `Analyze the following Discord conversation and extract three distinct types of information:
//
// 1. KEY POINTS: The main takeaways, important decisions, and key ideas discussed.
// 2. QUESTIONS ANSWERED: The key questions or problems this conversation addresses and resolves.
// 3. ENTITIES: Names of people, companies, tools, products, concepts, and other important entities mentioned.
//
// For each category, provide a comprehensive list with clear, concise entries.
//
// Conversation:
// ${markdown}`;
//
//   const { output: analysis } = await retry(async () => await generateText({
//     model: SUMMARIZATION_MODEL,
//     prompt: analysisPrompt,
//     output: Output.object({
//       schema: z.object({
//         keyPoints: z.array(z.string()),
//         questionsAnswered: z.array(z.string()),
//         entities: z.array(z.string()),
//       }),
//     }),
//   }), 3, 1);
//
//   await upsertMdArtifact({
//     integrationArtifactId,
//     integration: "Discord",
//     artifactDate: artifactDate ?? null,
//     markdown,
//     keyPoints: analysis.keyPoints,
//     questionsAnswered: analysis.questionsAnswered,
//     entities: analysis.entities,
//   });
// };
//
// const processThread = async (thread: DiscordChannelSelect): Promise<void> => {
//   const messages = await getMessagesByChannelId(thread.id, MESSAGE_CAP);
//   if (messages.length === 0) return;
//
//   const parentChannel = thread.parentId ? await getChannelById(thread.parentId) : undefined;
//   const guildName = thread.guildId ? (await getGuildById(thread.guildId))?.name : undefined;
//
//   const markdown = buildThreadMarkdown(thread, parentChannel, guildName, messages);
//   const artifactDate = messages[0]?.timestamp;
//   const integrationArtifactId = `thread:${thread.id}`;
//
//   await generateArtifact(integrationArtifactId, markdown, artifactDate);
// };
//
// const processChannel = async (channel: DiscordChannelSelect): Promise<void> => {
//   const messages = await getTopLevelMessagesByChannelId(channel.id);
//   if (messages.length === 0) return;
//
//   const guildName = channel.guildId ? (await getGuildById(channel.guildId))?.name : undefined;
//   const byDate = groupByDate(messages);
//
//   for (const [date, dayMessages] of byDate) {
//     const markdown = buildChannelDayMarkdown(channel, guildName, date, dayMessages);
//     const artifactDate = dayMessages[0]?.timestamp;
//     const integrationArtifactId = `channel:${channel.id}:${date}`;
//
//     await generateArtifact(integrationArtifactId, markdown, artifactDate);
//   }
// };
//
// export const parseDiscordStep = async (offset: number = 0): Promise<void> => {
//   let curOffset: number = offset;
//   let lengths: number[] = [];
//   let hasMoreThreads = true;
//
//   while (hasMoreThreads) {
//     const offsets: number[] = [];
//     for (let i = 0; i < MAX_WORKERS; i++) {
//       offsets.push(curOffset + i * PAGE_SIZE);
//     }
//
//     const threadBatches = await Promise.allSettled(
//       offsets.map((offset) => getThreadChannels(offset))
//     );
//
//     const fulfilledBatches = threadBatches
//       .filter((res): res is PromiseFulfilledResult<DiscordChannelSelect[]> => res.status === "fulfilled")
//       .map((r) => r.value);
//
//     await Promise.allSettled(
//       fulfilledBatches.flatMap((threads) =>
//         threads.map((thread) => processThread(thread))
//       )
//     );
//
//     lengths = threadBatches.map((r) =>
//       r.status === "fulfilled" ? r.value.length : PAGE_SIZE
//     );
//
//     hasMoreThreads = lengths.filter((len) => len < PAGE_SIZE).length === 0;
//     curOffset += MAX_WORKERS * PAGE_SIZE;
//   }
//
//   curOffset = 0;
//   let hasMoreChannels = true;
//
//   while (hasMoreChannels) {
//     const offsets: number[] = [];
//     for (let i = 0; i < MAX_WORKERS; i++) {
//       offsets.push(curOffset + i * PAGE_SIZE);
//     }
//
//     const channelBatches = await Promise.allSettled(
//       offsets.map((o) => getNonThreadChannels(o))
//     );
//
//     const fulfilledChannelBatches = channelBatches
//       .filter((r): r is PromiseFulfilledResult<DiscordChannelSelect[]> => r.status === "fulfilled")
//       .map((r) => r.value);
//
//     await Promise.allSettled(
//       fulfilledChannelBatches.flatMap((channels) =>
//         channels.map((channel) => processChannel(channel))
//       )
//     );
//
//     lengths = channelBatches.map((r) =>
//       r.status === "fulfilled" ? r.value.length : PAGE_SIZE
//     );
//
//     hasMoreChannels = lengths.filter((len) => len < PAGE_SIZE).length === 0;
//     curOffset += MAX_WORKERS * PAGE_SIZE;
//   }
//
//   await upsertSyncTask({
//     integration: "Discord",
//     status: "SUCCESS",
//     inputs: JSON.stringify({ step: "parse-messages" }),
//     step: "parse",
//   });
// };
