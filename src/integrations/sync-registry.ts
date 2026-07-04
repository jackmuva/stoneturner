import type { Integration } from "@/core/models/models";
import { gongIntegration } from "./gong/integration";
import { discordIntegration } from "./discord/integration";
import { notionIntegration } from "./notion/integration";
import { plaudIntegration } from "./plaud/integration";
import { firecrawlIntegration } from "./firecrawl/integration";
import { githubIntegration } from "./github/integration";
import { gmailIntegration } from "./gmail/integration";

export const supportedIntegrations: Integration[] = [
  gongIntegration,
  discordIntegration,
  notionIntegration,
  plaudIntegration,
  firecrawlIntegration,
  githubIntegration,
  gmailIntegration,
];
