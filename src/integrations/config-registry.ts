import type { IntegrationConfig } from "@/core/models/models";
import { gongConfig } from "./gong/config";

export const configRegistry: IntegrationConfig[] = [
  gongConfig
];
