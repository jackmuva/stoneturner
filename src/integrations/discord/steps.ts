import type { IntegrationSteps } from "@/core/models/models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { agentExploreContextStep } from "@/core/services/agent-explore-context-step";
import { parseDiscordMessages } from "./sync-steps/parse-message-threads";
import { syncChannels } from "./sync-steps/sync-channels";
import { syncMessages } from "./sync-steps/sync-messages";

export const steps: IntegrationSteps = {
  "discord-sync-channel-by-guild": syncChannels,
  "discord-sync-channel": syncMessages,
  "discord-parse-messages": parseDiscordMessages,
  "index-vector": indexVectorDbStep,
  "agent-explore": agentExploreContextStep,
};
