import type { MdArtifactSelect, SyncTaskSelect } from "@/core/db/schema/schema";
import { useParams } from "react-router";
import useSWR from 'swr'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import { Button } from "@/components/ui/button";
import { ArrowBigDownDashIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { ArtifactTable } from "./artifact-table";

export const IntegrationDataPage = () => {
  let { integration } = useParams();
  const [page, setPage] = useState<number>(0);

  const { data: artifacts, isLoading: artifactsIsLoading } = useSWR<MdArtifactSelect[]>(`artifacts/${integration}/${page}`, async (): Promise<MdArtifactSelect[]> => {
    const res = await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/artifacts/${integration}/${page}`, {
      method: "GET",
    });
    const body = await res.json();
    return body.artifacts ?? [];
  });

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
      <ArtifactTable setPage={setPage} artifacts={artifacts ?? []} isLoading={artifactsIsLoading}/>
    </div>
  );
}
