import type { IntegrationConfig } from "@/core/models/models";

export const PAGE_SIZE: number = 10;
export const MAX_WORKERS: number = 5;
export const SUMMARIZATION_MODEL: string = "zai/glm-5";

export const SupportedIntegrations: IntegrationConfig[] = [
  {
    integration: "Gong",
    icon: "/assets/gong.png",
    integrationType: "BASIC_TOKEN",
    docs: "https://help.gong.io/docs/receive-access-to-the-api",
    inputs: [
      {
        input: "accessKey",
        label: "Access Key",
        type: "text",
      },
      {
        input: "secretKey",
        label: "Access Key Secret",
        type: "text"
      },
      {
        input: "baseUrl",
        label: "Gong API Base URL",
        type: "text"
      }
    ],
  }
];

