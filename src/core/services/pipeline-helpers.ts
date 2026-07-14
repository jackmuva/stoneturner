import type { IntegrationStepFn } from "../models/models";
import { agentExploreContextStep, type AgentExploreInputs } from "./agent-explore-context-step";
import { indexVectorDbStep, type IndexVectorInputs } from "./index-vector-db-step";

export const bindIndexVector = (integration: string): IntegrationStepFn =>
  (incremental, db, inputs?, syncTaskId?) =>
    indexVectorDbStep(incremental, db, { integration, ...(inputs as IndexVectorInputs | undefined) }, syncTaskId);

export const bindAgentExplore = (integration: string): IntegrationStepFn =>
  (incremental, db, inputs?, syncTaskId?) =>
    agentExploreContextStep(incremental, db, { integration, ...(inputs as AgentExploreInputs | undefined) }, syncTaskId);
