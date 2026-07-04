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
  sync: (db: SqliteDb) => Promise<void> | void,
  syncUpdates: (db: SqliteDb) => Promise<void> | void,
  deleteSync: (db: SqliteDb) => Promise<void> | void,
  /** OAuth flows that require server-side setup (e.g. PKCE) before redirecting to the provider. */
  initiateOAuth?: (req: BunRequest, db: SqliteDb) => Promise<Response> | Response,
  handleRedirect?: (req: BunRequest, db: SqliteDb) => Promise<Response> | Response,
  refreshAccessTokens?: (db: SqliteDb) => Promise<void> | void,
}
