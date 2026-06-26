import type { Integration } from "@/core/models/models";
import { gongIntegration } from "./gong/integration";
import { discordIntegration } from "./discord/integration";
import { notionIntegration } from "./notion/integration";

export const supportedIntegrations: Integration[] = [
  gongIntegration,
  discordIntegration,
  notionIntegration,
];
