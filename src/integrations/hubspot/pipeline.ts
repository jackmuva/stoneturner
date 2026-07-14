import type { StepMapping, SyncStepPipeline } from "@/core/models/models";
import { bindAgentExplore } from "@/core/services/pipeline-helpers";
import { syncHubspotCompaniesStep } from "./sync-steps/sync-companies-step";
import { syncHubspotContactsStep } from "./sync-steps/sync-contacts-step";
import { syncHubspotDealsStep } from "./sync-steps/sync-deals-step";

const syncContacts: StepMapping = { "hubspot-sync-contacts": syncHubspotContactsStep };
const syncCompanies: StepMapping = { "hubspot-sync-companies": syncHubspotCompaniesStep };
const syncDeals: StepMapping = { "hubspot-sync-deals": syncHubspotDealsStep };
const agentExplore: StepMapping = { "agent-explore": bindAgentExplore("hubspot") };

export const hubspotPipeline: SyncStepPipeline = [
  [syncContacts, syncCompanies, syncDeals],
  [agentExplore],
];
