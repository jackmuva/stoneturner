import type { SyncPipelineSelect, SyncTaskSelect } from "@/core/db/schema/schema";
import useSWR from 'swr'
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { PAGE_SIZE } from "@/lib/constants";
import { configRegistry } from "@/integrations/config-registry";
import { SyncLogTable } from "./sync-log-table";
import { SyncLogSheet } from "./sync-log-sheet";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "../confirmation-dialog";

export type SyncSortOrder = "asc" | "desc";
export type SyncStatusFilter = "all" | "SUCCESS" | "FAILED";
type ConfirmAction = "retry";

export const SyncMonitoringPage = () => {
  const [page, setPage] = useState<number>(0);
  const [integration, setIntegration] = useState<string>("all");
  const [status, setStatus] = useState<SyncStatusFilter>("all");
  const [step, setStep] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<SyncSortOrder>("desc");
  const [selectedTask, setSelectedTask] = useState<SyncTaskSelect | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [retrySucceeded, setRetrySucceeded] = useState(false);

  const { data: syncPipelines } = useSWR<SyncPipelineSelect[]>(`sync-pipelines`, async () => {
    const res = await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/sync-pipeline`, {
      method: "GET",
    });
    const body = await res.json();
    return body.syncPipelines;
  }, {
    refreshInterval: 1000 * 60,
  });

  const { data: syncTasks, mutate: syncMutate, isLoading } = useSWR<SyncTaskSelect[]>(`syncTasks/all/${integration}/${status}/${step}/${sortOrder}/${page}`, async (): Promise<SyncTaskSelect[]> => {
    const params = new URLSearchParams({ offset: String(page * PAGE_SIZE), sortOrder });
    if (integration !== "all") params.set("integration", integration);
    if (status !== "all") params.set("status", status);
    if (step !== "all") params.set("step", step);

    const res = await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/syncTasks?${params.toString()}`, {
      method: "GET",
    });
    const body = await res.json();
    return body.syncTasks ?? [];
  }, {
    refreshInterval: (syncPipelines ?? []).filter((sync) => sync.status === "SYNCING").length > 0 ? (5 * 1000) : 0,
    keepPreviousData: true,
  });

  const { data: steps } = useSWR<string[]>("syncTasks/steps", async (): Promise<string[]> => {
    const res = await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/syncTasks/steps`, {
      method: "GET",
    });
    const body = await res.json();
    return body.steps ?? [];
  }, {
    keepPreviousData: true,
    refreshInterval: (syncPipelines ?? []).filter((sync) => sync.status === "SYNCING").length > 0 ? (5 * 1000) : 0
  });

  const handleSort = () => {
    setPage(0);
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const confirmConfig: Record<ConfirmAction, { text: string; onConfirm: () => void | Promise<void> }> = {
    retry: {
      text: "This will retry all failed sync tasks that haven't exceeded the retry limit. Continue?",
      onConfirm: async () => {
        await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/syncTasks/retry`, {
          method: "POST",
        });
        setConfirmAction(null);
        setRetrySucceeded(true);
        syncMutate();
        setTimeout(() => setRetrySucceeded(false), 3000);
      },
    },
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
          <div className="flex flex-row gap-3 items-center justify-between overflow-x-auto">
            <div className="flex gap-3 items-start flex-col sm:flex-row">
              <Select value={integration} onValueChange={(value) => { setIntegration(value); setPage(0); }}>
                <SelectTrigger size="sm" className="w-44">
                  <SelectValue placeholder="Integration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All integrations</SelectItem>
                  {configRegistry.map((intConfig) => (
                    <SelectItem key={intConfig.integration} value={intConfig.integration}>
                      <img src={intConfig.icon} alt={intConfig.icon} height={20} width={20} />
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
                </SelectContent>
              </Select>
              <Select value={step} onValueChange={(value) => { setStep(value); setPage(0); }}>
                <SelectTrigger size="sm" className="w-56">
                  <SelectValue placeholder="Step" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All steps</SelectItem>
                  {(steps ?? []).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 items-end flex-col sm:flex-row">
              <Button variant="outline" size="sm" onClick={() => setConfirmAction("retry")} disabled={retrySucceeded}
              className="bg-brand-purple/20 dark:bg-brand-purple/70 rounded-md">
                {retrySucceeded ? "retry initiated" : "Retry failed tasks"}
              </Button>
            </div>
          </div>
          {((syncPipelines ?? []).filter((sync) => sync.status === "SYNCING").length > 0) && <div className="w-52 flex gap-1 items-center border rounded-sm py-1 px-2">
            <span className="text-sm animate-pulse">Syncing...</span>
            <span className="animate-left-right">
              <img src={"/assets/stoneturner.png"} alt="stoneturner-logo" className="animate-roll" width={25} height={25} />
            </span>
          </div>}
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
      <ConfirmationDialog
        open={confirmAction !== null}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
        text={confirmAction ? confirmConfig[confirmAction].text : ""}
        onConfirm={confirmAction ? confirmConfig[confirmAction].onConfirm : () => { }}
      />
    </div >
  );
}
