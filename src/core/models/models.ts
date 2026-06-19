export type IntegrationConfig = {
  integration: string,
  icon: string,
  integrationType: "BASIC_TOKEN" | "OAUTH" | "API_KEY",
  docs?: string,
  inputs?: {
    input: "accessToken" | "refreshToken" | "accessKey" | "secretKey" | "baseUrl",
    label: string,
  }[],
  oauthAuthorizationUrl?: string,
};

export type Integration = {
  config: IntegrationConfig,
  sync: () => Promise<void> | void,
  syncUpdates: () => Promise<void> | void,
  deleteSync: () => Promise<void> | void,
}
