"use client";

import useSWR from 'swr'
import { Integration, IntegrationConfig, SyncTaskSelect } from "@/models/integration-models";
import { IntegrationCard } from "./integration-card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { SupportedIntegrations } from '@/lib/constants';

export const KnowledgeBasePage = ({
  userId,
}: {
  userId: string,
}) => {
  const { data: integrations, mutate: integrationsMutate, isLoading: integrationsIsLoading } = useSWR<Integration[]>(`integrations/${userId}`, async (): Promise<Integration[]> => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/api/integrations`, {
      method: "GET",
      credentials: "include"
    });
    const body = await res.json();
    return body.integrations;
  });

  const { data: syncTasks, mutate: syncTaskMutate, isLoading: syncsIsLoading } = useSWR<SyncTaskSelect[]>(`syncTasks/${userId}`, async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/api/syncTasks/recent`, {
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
        {!integrationsIsLoading && integrations && !syncsIsLoading && SupportedIntegrations.map((intConfig: IntegrationConfig) => {
          return <IntegrationCard key={intConfig.integration}
            intConfig={intConfig}
            userId={userId}
            integrations={integrations}
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
