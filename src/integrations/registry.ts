import type { Integration } from "@/core/models/models";
import { gongIntegration } from "./gong/integration";

export const SupportedIntegrations: Integration[] = [
  gongIntegration,
];
