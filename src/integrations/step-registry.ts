import type { StepMapping } from "@/core/models/models";
import { steps as discordSteps } from "./discord/steps";
import { steps as firecrawlSteps } from "./firecrawl/steps";
import { steps as githubSteps } from "./github/steps";
import { steps as gongSteps } from "./gong/steps";
import { steps as notionSteps } from "./notion/steps";
import { steps as plaudSteps } from "./plaud/steps";
import { steps as slackSteps } from "./slack/steps";
import { steps as spotifySteps } from "./spotify/steps";
import { steps as twitterSteps } from "./twitter/steps";

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
