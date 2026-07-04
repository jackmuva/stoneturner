import type { IntegrationConfig } from "@/core/models/models";
import { gongConfig } from "./gong/config";
import { discordConfig } from "./discord/config";
import { notionConfig } from "./notion/config";
import { plaudConfig } from "./plaud/config";
import { firecrawlConfig } from "./firecrawl/config";
import { githubConfig } from "./github/config";
import { spotifyConfig } from "./spotify/config";
import { slackConfig } from "./slack/config";

export const configRegistry: IntegrationConfig[] = [
  gongConfig,
  discordConfig,
  notionConfig,
  plaudConfig,
  firecrawlConfig,
  githubConfig,
  spotifyConfig,
  slackConfig,
];
