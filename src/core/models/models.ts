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

export type VectorDbMetadata = {
  integrationArtifactId: string,
  integration: string,
  artifactDate: number,
  updateDate: number,
  entities: string[],
};


