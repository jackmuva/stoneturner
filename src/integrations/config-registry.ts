import type { IntegrationConfig } from "@/core/models/models";
import { gongConfig } from "./gong/config";
import { discordConfig } from "./discord/config";

export const configRegistry: IntegrationConfig[] = [
  gongConfig,
  discordConfig,
];
