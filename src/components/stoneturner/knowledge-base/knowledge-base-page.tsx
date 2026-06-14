import useSWR from 'swr'
import { IntegrationCard } from "./integration-card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { configRegistry } from '@/integrations/config-registry';
import type { IntegrationCredential, SyncTaskSelect } from '@/core/db/schema/schema';
import type { IntegrationConfig } from '@/core/models/models';

export const KnowledgeBasePage = () => {
  const { data: integrations, mutate: integrationsMutate, isLoading: integrationsIsLoading } = useSWR<IntegrationCredential[]>(`integrations`, async (): Promise<IntegrationCredential[]> => {
    const res = await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/integrations`, {
      method: "GET",
    });
    const body = await res.json();
    return body.integrations ?? [];
  });

  const { data: syncTasks, mutate: syncTaskMutate, isLoading: syncsIsLoading } = useSWR<SyncTaskSelect[]>(`syncTasks`, async () => {
    const res = await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/syncTasks/recent`, {
      method: "GET",
      credentials: "include"
    });
    const body = await res.json();
    return body.syncTasks;
  }, {
    refreshInterval: 1000 * 60,
  });

  return (
    <div className="w-full h-full flex flex-col gap-4 p-4 font-mono">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className='text-base'>
              Knowledge Base
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="animate-appear grid grid-cols-1 md:grid-cols-3">
        {configRegistry.map((intConfig: IntegrationConfig) => {
          return <IntegrationCard key={intConfig.integration}
            intConfig={intConfig}
            integrations={integrations ?? []}
            integrationsMutate={integrationsMutate}
            syncing={syncTasks ? syncTasks.filter((task) => {
              return task.integration === intConfig.integration
            }).length > 0 : false}
            syncTaskMutate={syncTaskMutate}
          />
        })}
      </div>
    </div >
  );
}
