import type { IntegrationSteps } from "@/core/models/models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { asInputs, resumeOffset } from "@/integrations/retry-step-utils";
import { parseDiscordMessages } from "./sync-steps/parse-message-threads";
import { syncChannels } from "./sync-steps/sync-channels";
import { syncMessages } from "./sync-steps/sync-messages";

type DiscordParseCursor = {
  thread: boolean;
  channelId: string;
  readableDate: string;
  start: string;
  end?: string;
};

export const discordSteps: IntegrationSteps = {
  "discord-sync-channel-by-guild": (db, inputs, syncTaskId) => {
    const guildId = asInputs(inputs)?.guildId;
    return syncChannels(db, true, typeof guildId === "string" ? guildId : undefined, syncTaskId);
  },
  "discord-sync-channel": (db, inputs, syncTaskId) => {
    const obj = asInputs(inputs);
    const channelId = obj?.channelId;
    const lastMessageId = obj?.cursor;
    const cursor = typeof channelId === "string" && typeof lastMessageId === "string"
      ? { channelId, lastMessageId }
      : undefined;
    return syncMessages(true, db, cursor, syncTaskId);
  },
  "discord-parse-messages": (db, inputs, syncTaskId) =>
    parseDiscordMessages(true, db, asInputs(inputs) as DiscordParseCursor | undefined, syncTaskId),
  "index-vector": (db, inputs, syncTaskId) => indexVectorDbStep("discord", true, db, resumeOffset(inputs), syncTaskId),
};
