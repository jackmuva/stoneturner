import type { IntegrationConfig } from "@/core/models/models";

export const gongConfig: IntegrationConfig = {
  integration: "Gong",
  icon: "/assets/gong.png",
  integrationType: "BASIC_TOKEN",
  docs: "https://help.gong.io/docs/receive-access-to-the-api",
  inputs: [
    {
      input: "accessKey",
      label: "Access Key",
    },
    {
      input: "secretKey",
      label: "Access Key Secret",
    },
    {
      input: "baseUrl",
      label: "Gong API Base URL",
    }
  ],
}


