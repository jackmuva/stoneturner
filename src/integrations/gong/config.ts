import type { IntegrationConfig } from "@/core/models/models";

export const gongConfig: IntegrationConfig = {
  integration: "gong",
  icon: "/assets/gong.png",
  integrationType: "BASIC_TOKEN",
  description: "Connect your data integration via a basic token found in your Gong settings. Visit the [Gong docs](https://help.gong.io/docs/receive-access-to-the-api) for further instruction.",
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
