import type { IntegrationSteps } from "@/core/models/models";
import { indexVectorDbStep } from "@/core/services/index-vector-db-step";
import { asInputs, resumeOffset } from "@/integrations/retry-step-utils";
import { parseSlackMessages, type SlackParseCursor } from "./sync-steps/parse-message-threads";
import { syncChannels, type SlackChannelsCursor } from "./sync-steps/sync-channels";
import { syncMessages, type SlackMessagesCursor } from "./sync-steps/sync-messages";
import { syncThreadReplies, type SlackThreadRepliesCursor } from "./sync-steps/sync-thread-replies";
import { syncUsers } from "./sync-steps/sync-users";
import type { SlackUsersCursor } from "./sync-steps/sync-users";

export const slackSteps: IntegrationSteps = {
  "slack-sync-channels": (db, inputs, syncTaskId) => syncChannels(db, asInputs(inputs) as SlackChannelsCursor | undefined, syncTaskId),
  "slack-sync-users": (db, inputs, syncTaskId) => syncUsers(db, asInputs(inputs) as SlackUsersCursor | undefined, syncTaskId),
  "slack-sync-channel-messages": (db, inputs, syncTaskId) => syncMessages(true, db, asInputs(inputs) as SlackMessagesCursor | undefined, syncTaskId),
  "slack-sync-thread-replies": (db, inputs, syncTaskId) => syncThreadReplies(true, db, asInputs(inputs) as SlackThreadRepliesCursor | undefined, syncTaskId),
  "slack-parse-messages": (db, inputs, syncTaskId) =>
    parseSlackMessages(true, db, asInputs(inputs) as SlackParseCursor | undefined, syncTaskId),
  "index-vector": (db, inputs, syncTaskId) => indexVectorDbStep("slack", true, db, resumeOffset(inputs), syncTaskId),
};
