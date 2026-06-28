import type { BunRequest } from "bun";

export type IntegrationConfig = {
  integration: string,
  icon: string,
  integrationType: "BASIC_TOKEN" | "OAUTH" | "API_KEY",
  description?: string,
  inputs?: {
    input: "accessKey" | "baseUrl" | "secretKey",
    label: string,
  }[],
  options?: Record<string, string>,
  oauthAuthorizationUrl?: string,
  installUrl?: string,
};

export type Integration = {
  config: IntegrationConfig,
  sync: () => Promise<void> | void,
  syncUpdates: () => Promise<void> | void,
  deleteSync: () => Promise<void> | void,
  handleRedirect?: (req: BunRequest) => Promise<Response> | Response,
  refreshAccessTokens?: () => Promise<void> | void,
}
