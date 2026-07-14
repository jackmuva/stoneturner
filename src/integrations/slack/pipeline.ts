import type { StepMapping, SyncStepPipeline } from "@/core/models/models";
import { bindAgentExplore, bindIndexVector } from "@/core/services/pipeline-helpers";
import { parseSlackMessages } from "./sync-steps/parse-message-threads";
import { syncChannels } from "./sync-steps/sync-channels";
import { syncMessages } from "./sync-steps/sync-messages";
import { syncThreadReplies } from "./sync-steps/sync-thread-replies";
import { syncUsers } from "./sync-steps/sync-users";

const syncSlackChannels: StepMapping = { "slack-sync-channels": syncChannels };
const syncSlackUsers: StepMapping = { "slack-sync-users": syncUsers };
const syncSlackChannelMessages: StepMapping = { "slack-sync-channel-messages": syncMessages };
const syncSlackThreadReplies: StepMapping = { "slack-sync-thread-replies": syncThreadReplies };
const parse: StepMapping = { "slack-parse-messages": parseSlackMessages };
const indexVector: StepMapping = { "index-vector": bindIndexVector("slack") };
const agentExplore: StepMapping = { "agent-explore": bindAgentExplore("slack") };

export const slackPipeline: SyncStepPipeline = [
  [syncSlackChannels],
  [syncSlackUsers],
  [syncSlackChannelMessages],
  [syncSlackThreadReplies],
  [parse],
  [indexVector],
  [agentExplore],
];
