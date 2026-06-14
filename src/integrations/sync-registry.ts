import type { Integration } from "@/core/models/models";
import { gongIntegration } from "./gong/integration";

export const supportedIntegrations: Integration[] = [
  gongIntegration,
];
