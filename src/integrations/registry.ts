import type { IntegrationConfig } from "@/core/models/models";
import { gongConfig } from "@/integrations/gong/config";

export const SupportedIntegrations: IntegrationConfig[] = [
  gongConfig,
];
