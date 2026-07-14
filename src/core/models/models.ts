import type { BunRequest } from "bun";
import type { SqliteDb } from "./db-models";

export type IntegrationConfig = {
  integration: string,
  icon: string,
  integrationType: "BASIC_TOKEN" | "OAUTH" | "API_KEY",
  description?: string,
  inputs?: {
    input: "accessKey" | "baseUrl" | "secretKey",
    label: string,
  }[],
  optionInputs?: {
    key: string,
    label: string,
    optional?: boolean,
  }[],
  options?: Record<string, string>,
  oauthAuthorizationUrl?: string,
  installUrl?: string,
};

export type Integration = {
  config: IntegrationConfig,
  syncPipeline: SyncStepPipeline,
  deleteSync: (db: SqliteDb) => Promise<void> | void,
  handleRedirect?: (req: BunRequest, db: SqliteDb) => Promise<Response> | Response,
  refreshAccessTokens?: (db: SqliteDb) => Promise<void> | void,
}

export type IntegrationStepFn = (incremental: boolean, db: SqliteDb, inputs?: any, syncTaskId?: string) => Promise<void> | void;
export type StepMapping = { [stepName: string]: IntegrationStepFn };
export type SyncStepPipeline = Array<Array<StepMapping>>;
