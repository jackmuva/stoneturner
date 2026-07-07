import type { IntegrationSteps } from "@/core/models/models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { parseSlackMessages } from "./sync-steps/parse-message-threads";
import { syncChannels } from "./sync-steps/sync-channels";
import { syncMessages } from "./sync-steps/sync-messages";
import { syncThreadReplies } from "./sync-steps/sync-thread-replies";
import { syncUsers } from "./sync-steps/sync-users";

export const steps: IntegrationSteps = {
  "slack-sync-channels": syncChannels,
  "slack-sync-users": syncUsers,
  "slack-sync-channel-messages": syncMessages,
  "slack-sync-thread-replies": syncThreadReplies,
  "slack-parse-messages": parseSlackMessages,
  "index-vector": indexVectorDbStep,
};
