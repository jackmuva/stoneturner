import type { SyncTaskSelect } from "@/core/db/schema/schema";
import useSWR from 'swr'
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { PAGE_SIZE } from "@/lib/constants";
import { configRegistry } from "@/integrations/config-registry";
import { SyncLogTable } from "./sync-log-table";
import { SyncLogSheet } from "./sync-log-sheet";

export type SyncSortOrder = "asc" | "desc";
export type SyncStatusFilter = "all" | "SUCCESS" | "FAILED" | "PENDING";

export const SyncMonitoringPage = () => {
  const [page, setPage] = useState<number>(0);
  const [integration, setIntegration] = useState<string>("all");
  const [status, setStatus] = useState<SyncStatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<SyncSortOrder>("desc");
  const [selectedTask, setSelectedTask] = useState<SyncTaskSelect | null>(null);

  const { data: syncTasks, isLoading } = useSWR<SyncTaskSelect[]>(`syncTasks/all/${integration}/${status}/${sortOrder}/${page}`, async (): Promise<SyncTaskSelect[]> => {
    const params = new URLSearchParams({ offset: String(page * PAGE_SIZE), sortOrder });
    if (integration !== "all") params.set("integration", integration);
    if (status !== "all") params.set("status", status);
    const res = await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/syncTasks?${params.toString()}`, {
      method: "GET",
    });
    const body = await res.json();
    return body.syncTasks ?? [];
  }, {
    keepPreviousData: true,
    refreshInterval: 1000 * 60,
  });

  const handleSort = () => {
    setPage(0);
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  return (
    <div className="w-full h-full min-w-0 min-h-0 flex flex-col gap-4 p-4 font-sans">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className='text-base'>
              Sync Monitoring
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex-1 min-h-0 flex flex-row gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-4 min-h-0">
          <div className="flex flex-row gap-3 items-center">
            <Select value={integration} onValueChange={(value) => { setIntegration(value); setPage(0); }}>
              <SelectTrigger size="sm" className="w-44">
                <SelectValue placeholder="Integration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All integrations</SelectItem>
                {configRegistry.map((intConfig) => (
                  <SelectItem key={intConfig.integration} value={intConfig.integration}>
                    {intConfig.integration}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(value) => { setStatus(value as SyncStatusFilter); setPage(0); }}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="SUCCESS">Success</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SyncLogTable
            setPage={setPage}
            tasks={syncTasks ?? []}
            isLoading={isLoading}
            sortOrder={sortOrder}
            onSort={handleSort}
            onRowClick={setSelectedTask}
          />
        </div>
        <SyncLogSheet task={selectedTask} onClose={() => setSelectedTask(null)} />
      </div>
    </div >
  );
}
