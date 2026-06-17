import type { MdArtifactSelect, SyncTaskSelect } from "@/core/db/schema/schema";
import { useParams } from "react-router";
import useSWR from 'swr'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import { Button } from "@/components/ui/button";
import { ArrowBigDownDashIcon, RefreshCwIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { PAGE_SIZE } from "@/lib/constants";
import { ArtifactTable } from "./artifact-table";

export type ArtifactSortField = "updateDate" | "artifactDate";
export type SortOrder = "asc" | "desc";

export const IntegrationDataPage = () => {
  let { integration } = useParams();
  const [page, setPage] = useState<number>(0);
  const [searchInput, setSearchInput] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<ArtifactSortField>("updateDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

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

  const handleSort = (field: ArtifactSortField) => {
    setPage(0);
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const { data: syncTasks, mutate: syncTaskMutate, isLoading: syncsIsLoading } = useSWR<SyncTaskSelect[]>(`syncTasks`, async () => {
    const res = await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/syncTasks/recent`, {
      method: "GET",
    });
    const body = await res.json();
    return body.syncTasks;
  }, {
    refreshInterval: 1000 * 60,
  });

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
      <ButtonGroup className="flex">
        <Button variant={"outline"} size="sm" className="bg-brand-purple/10">
          <ArrowBigDownDashIcon size={12}/>
          Full Sync
        </Button>
        <ButtonGroupSeparator />
        <Button variant={"outline"} size={"sm"} className="bg-brand-cream/10">
          <RefreshCwIcon size={12}/>
          Sync Updates
        </Button>
        <Button variant={"destructive"} size="sm" className="bg-red-500/10 text-black">
          <Trash2Icon size={12}/>
          Delete Synced Data
        </Button>
      </ButtonGroup>
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
        artifacts={artifacts ?? []}
        isLoading={artifactsIsLoading}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
      />
    </div>
  );
}
