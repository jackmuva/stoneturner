import type { MdArtifactSelect, SyncTaskSelect } from "@/core/db/schema/schema";
import { useParams } from "react-router";
import useSWR from 'swr'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import { Button } from "@/components/ui/button";
import { ArrowBigDownDashIcon, KeyRoundIcon, MoreVerticalIcon, RefreshCwIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IntegrationDialog } from "./integration-dialog";
import { configRegistry } from "@/integrations/config-registry";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { PAGE_SIZE } from "@/lib/constants";
import { ArtifactTable } from "./artifact-table";
import { ArtifactDetailSheet } from "./artifact-detail-sheet";
import { ConfirmationDialog } from "../confirmation-dialog";

type ConfirmAction = "fullSync" | "syncUpdates" | "delete";
export type ArtifactSortField = "updateDate" | "artifactDate";
export type SortOrder = "asc" | "desc";

export const IntegrationDataPage = () => {
  let { integration } = useParams();
  const [page, setPage] = useState<number>(0);
  const [searchInput, setSearchInput] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<ArtifactSortField>("artifactDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedArtifact, setSelectedArtifact] = useState<MdArtifactSelect | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [reauthOpen, setReauthOpen] = useState<boolean>(false);
  const [optimisticSync, setOptimisticSync] = useState<boolean>(false);
  const [optimisticDelete, setOptimisticDelete] = useState<boolean>(false);

  const intConfig = configRegistry.find(
    (config) => config.integration.toLowerCase() === integration?.toLowerCase()
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const { data: artifacts, isLoading: artifactsIsLoading } = useSWR<MdArtifactSelect[]>(`artifacts/${integration}/${page}/${sortBy}/${sortOrder}/${search}`, async (): Promise<MdArtifactSelect[]> => {
    const params = new URLSearchParams({ offset: String(page * PAGE_SIZE), sortBy, sortOrder });
    if (search) params.set("search", search);
    const res = await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/artifacts/${integration}?${params.toString()}`, {
      method: "GET",
    });
    const body = await res.json();
    return body.artifacts ?? [];
  }, {
    keepPreviousData: true,
  });

  const { data: syncTasks } = useSWR<SyncTaskSelect[]>(`syncTasks`, async () => {
    setOptimisticSync(false);
    const res = await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/syncTasks/recent`, {
      method: "GET",
    });
    const body = await res.json();
    return body.syncTasks;
  }, {
    refreshInterval: 1000 * 60,
  });

  const handleSort = (field: ArtifactSortField) => {
    setPage(0);
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const confirmConfig: Record<ConfirmAction, { text: string; onConfirm: () => void | Promise<void> }> = {
    fullSync: {
      text: `This will run a full sync of all ${integration} data and may take a while. Continue?`,
      onConfirm: async () => {
        await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/sync/${integration}`, {
          method: "POST",
        });
        setConfirmAction(null);
        setOptimisticSync(true);
      },
    },
    syncUpdates: {
      text: `This will sync recent updates from ${integration}. Continue?`,
      onConfirm: async () => {
        await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/sync/updates/${integration}`, {
          method: "POST",
        });
        setConfirmAction(null);
        setOptimisticSync(true);
      },
    },
    delete: {
      text: `This will delete all synced data for ${integration}. This cannot be undone.`,
      onConfirm: async () => {
        await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/sync/${integration}`, {
          method: "DELETE",
        });
        setConfirmAction(null);
        setOptimisticDelete(true);
      },
    },
  };

  return (
    <div className="w-full h-full min-w-0 min-h-0 flex flex-col gap-4 p-4 font-sans">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink className='text-base' href="/">
              Knowledge Base
            </BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbPage className='text-base'>
              {integration}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex-1 min-h-0 flex flex-row gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-4 min-h-0">
          <div className="flex flex-col gap-4 w-full">
            <ButtonGroup className="flex">
              <Button variant={"outline"} size="sm" className="bg-brand-purple/20 dark:bg-brand-purple/70"
                disabled={(syncTasks && syncTasks.length > 0)}
                onClick={() => setConfirmAction("fullSync")}>
                <ArrowBigDownDashIcon size={12} />
                Full Sync
              </Button>
              <ButtonGroupSeparator />
              <Button variant={"outline"} size={"sm"} className="bg-brand-cream/20 dark:bg-brand-cream/70"
                disabled={(syncTasks && syncTasks.length > 0)}
                onClick={() => setConfirmAction("syncUpdates")}>
                <RefreshCwIcon size={12} />
                Sync Updates
              </Button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant={"outline"} size="sm">
                    <MoreVerticalIcon size={12} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {intConfig && (
                    <DropdownMenuItem onClick={() => setReauthOpen(true)}>
                      <KeyRoundIcon size={12} />
                      Reauthenticate
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirmAction("delete")}>
                    <Trash2Icon size={12} />
                    Delete Synced Data
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
            {(optimisticSync || (syncTasks && syncTasks.filter((task) => task.integration === integration).length > 0)) && <div className="w-52 flex gap-1 items-center">
              <span className="text-sm animate-pulse">Syncing...</span>
              <span className="animate-left-right">
                <img src={"/assets/stoneturner.png"} alt="stoneturner-logo" className="animate-roll" width={25} height={25} />
              </span>
            </div>}
          </div>
          <div className="relative w-full max-w-sm">
            <SearchIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search artifacts..."
              className="pl-8"
            />
          </div>
          <ArtifactTable
            setPage={setPage}
            artifacts={optimisticDelete ? [] : (artifacts ?? [])}
            isLoading={artifactsIsLoading}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onRowClick={setSelectedArtifact}
          />
        </div>
        <ArtifactDetailSheet artifact={selectedArtifact} onClose={() => setSelectedArtifact(null)} />
      </div>
      <ConfirmationDialog
        open={confirmAction !== null}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
        text={confirmAction ? confirmConfig[confirmAction].text : ""}
        onConfirm={confirmAction ? confirmConfig[confirmAction].onConfirm : () => { }}
      />
      {intConfig && (
        <IntegrationDialog
          intConfig={intConfig}
          open={reauthOpen}
          onOpenChange={setReauthOpen}
        />
      )}
    </div >
  );
}
