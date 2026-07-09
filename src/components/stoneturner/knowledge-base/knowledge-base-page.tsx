import { useState } from 'react'
import useSWR from 'swr'
import { IntegrationCard } from "./integration-card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { Input } from '@/components/ui/input';
import { configRegistry } from '@/integrations/config-registry';
import type { IntegrationCredential, SyncPipelineSelect } from '@/core/db/schema/schema';
import type { IntegrationConfig } from '@/core/models/models';
import { useParams } from 'react-router-dom';
import { ConnectInstructionsCard } from './connect-instructions-card';

export const KnowledgeBasePage = () => {
  let { integration } = useParams();
  const [search, setSearch] = useState("");

  const { data: integrations, mutate: integrationsMutate } = useSWR<IntegrationCredential[]>(`integrations`, async (): Promise<IntegrationCredential[]> => {
    const res = await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/integrations`, {
      method: "GET",
    });
    const body = await res.json();
    return body.integrations ?? [];
  });

  const { data: syncPipelines } = useSWR<SyncPipelineSelect[]>(`sync-pipelines`, async () => {
    const res = await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/sync-pipeline`, {
      method: "GET",
    });
    const body = await res.json();
    return body.syncPipelines;
  }, {
    refreshInterval: 1000 * 60,
  });

  return (
    <div className="w-full h-full flex flex-col gap-4 p-4 font-sans">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className='text-base'>
              Knowledge Base
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="animate-appear grid grid-cols-1 md:grid-cols-3 gap-3">
        <ConnectInstructionsCard />
        <Input type="search"
          placeholder="Search integrations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          
          className="max-w-sm col-span-full" />
        {configRegistry
          .filter((intConfig: IntegrationConfig) =>
            intConfig.integration.toLowerCase().includes(search.toLowerCase()))
          .map((intConfig: IntegrationConfig) => {
            return <IntegrationCard key={intConfig.integration}
              intConfig={intConfig}
              integrations={integrations ?? []}
              integrationsMutate={integrationsMutate}
              syncing={syncPipelines?.some((p) => p.integration === intConfig.integration && p.status === "SYNCING") ?? false}
              openDialog={intConfig.integration.toLowerCase() === integration?.toLowerCase()}
            />
          })}
      </div>
    </div >
  );
}
