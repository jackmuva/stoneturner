export type IntegrationConfig = {
  integration: string,
  icon: string,
  integrationType: "BASIC_TOKEN" | "OAUTH" | "API_KEY",
  docs: string,
  inputs: {
    input: "accessToken" | "refreshToken" | "accessKey" | "secretKey" | "baseUrl",
    label: string,
  }[],
};

export type Integration = {
  config: IntegrationConfig,
  sync: () => void,
}
