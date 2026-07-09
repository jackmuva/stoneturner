import { EXPLORE_MODEL } from "@/lib/constants";
import type { SqliteDb } from "../models/db-models";
import { ToolLoopAgent, isStepCount } from "ai";
import { createExploreAgentTools } from "./tools/explore-tools";
import { upsertSourceContext, upsertSyncTask } from "../db/queries/queries";

export type AgentExploreInputs = {
  integration: string,
};

export const agentExploreContextStep = async (_incremental: boolean = true, db: SqliteDb, inputs: AgentExploreInputs, syncTaskId?: string) => {
  const { integration } = inputs;
  try {
    const exploreAgent = getExploreAgent(integration, db);

    const result = await exploreAgent.generate({
      prompt: `Explore the user's ${integration} data and write a concise AGENTS.md file for future agents to familiarize itself with the ${integration} data`,
    });

    await upsertSourceContext({
      integration,
      context: result.text,
    }, db);

    await upsertSyncTask({
      id: syncTaskId,
      integration: integration,
      status: "SUCCESS",
      error: null,
      inputs: { integration: integration },
      step: "agent-explore",
    }, db);
  } catch (e) {
    await upsertSyncTask({
      id: syncTaskId,
      integration: integration,
      status: "FAILED",
      error: String(e),
      inputs: { integration: integration },
      step: "agent-explore",
    }, db);
  }
}

const getExploreAgent = (integration: string, db: SqliteDb) => {
  const exploreAgent = new ToolLoopAgent({
    model: EXPLORE_MODEL,
    instructions: `You are an exploratory agent whose job is to explore the data in the user's ${integration} and write a concise markdown writeup on the type of data and common themes in this ${integration} data source.

You have the following tools to aid your exploration and writeup: get_most_recent_records, get_tables, execute_sqlite_query, get_artifact_by_id, and search_semantically.

Start with get_most_recent_records to sample recent ${integration} artifacts, then use get_tables and execute_sqlite_query to inspect raw ${integration} tables if helpful. Use search_semantically to find related content — it can search across all integrations when you want to explore connections with other data sources. Use get_artifact_by_id to read full artifact content.

You should generate a concise markdown writeup with common themes, entities, projects, ideas, etc. that are common among the user's ${integration}.

DO NOT include details that aren't pervasive across the user's ${integration}.
The markdown writeup will be used by future agent's as a "lay-of-the-land" type document that will be given to each agent before they explore the ${integration} data in the future.`,
    tools: createExploreAgentTools(integration, db),
    stopWhen: isStepCount(25),
  });

  return exploreAgent;
}
