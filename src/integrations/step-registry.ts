import type { StepMapping } from "@/core/models/models";
import { discordSteps } from "./discord/discordSteps";
import { firecrawlSteps } from "./firecrawl/firecrawlSteps";
import { githubSteps } from "./github/githubSteps";
import { gongSteps } from "./gong/gongSteps";
import { notionSteps } from "./notion/notionSteps";
import { plaudSteps } from "./plaud/plaudSteps";
import { slackSteps } from "./slack/slackSteps";
import { spotifySteps } from "./spotify/spotifySteps";
import { twitterSteps } from "./twitter/twitterSteps";

export const stepRegistry: StepMapping = {
  gong: gongSteps,
  discord: discordSteps,
  notion: notionSteps,
  plaud: plaudSteps,
  firecrawl: firecrawlSteps,
  github: githubSteps,
  spotify: spotifySteps,
  slack: slackSteps,
  twitter: twitterSteps,
};

export const getStepFn = (integration: string, step: string) => stepRegistry[integration.toLowerCase()]?.[step];
