import type { IntegrationSteps } from "@/core/models/models";
import { agentExploreContextStep } from "@/core/services/agent-explore-context-step";
import { syncHubspotContactsStep } from "./sync-steps/sync-contacts-step";
import { syncHubspotCompaniesStep } from "./sync-steps/sync-companies-step";
import { syncHubspotDealsStep } from "./sync-steps/sync-deals-step";

export const steps: IntegrationSteps = {
  "hubspot-sync-contacts": syncHubspotContactsStep,
  "hubspot-sync-companies": syncHubspotCompaniesStep,
  "hubspot-sync-deals": syncHubspotDealsStep,
  "agent-explore": agentExploreContextStep,
};
