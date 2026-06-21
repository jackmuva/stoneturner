import type { Integration } from "@/core/models/models";
import { gongIntegration } from "./gong/integration";
import { discordIntegration } from "./discord/integration";

export const supportedIntegrations: Integration[] = [
  gongIntegration,
  discordIntegration,
];
