import type { StepMapping, SyncStepPipeline } from "@/core/models/models";
import { bindAgentExplore, bindIndexVector } from "@/core/services/pipeline-helpers";
import { parseDiscordMessages } from "./sync-steps/parse-message-threads";
import { syncChannels } from "./sync-steps/sync-channels";
import { syncMessages } from "./sync-steps/sync-messages";

const syncChannelByGuild: StepMapping = { "discord-sync-channel-by-guild": syncChannels };
const syncChannel: StepMapping = { "discord-sync-channel": syncMessages };
const parse: StepMapping = { "discord-parse-messages": parseDiscordMessages };
const indexVector: StepMapping = { "index-vector": bindIndexVector("discord") };
const agentExplore: StepMapping = { "agent-explore": bindAgentExplore("discord") };

export const discordPipeline: SyncStepPipeline = [
  [syncChannelByGuild],
  [syncChannel],
  [parse],
  [indexVector],
  [agentExplore],
];
