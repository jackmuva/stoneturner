export type IntegrationConfig = {
  integration: string,
  icon: string,
  integrationType: "BASIC_TOKEN" | "OAUTH" | "API_KEY",
  docs: string,
  inputs: {
    input: string,
    label: string,
    type: "text"
  }[],
};

export type VectorDbMetadata = {
  integrationArtifactId: string,
  integration: string,
  artifactDate: number,
  updateDate: number,
  entities: string[],
};


