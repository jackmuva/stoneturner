import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SyncTaskSelect } from "@/core/db/schema/schema"
import { configRegistry } from "@/integrations/config-registry";
import { PAGE_SIZE } from "@/lib/constants";
import { ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, ChevronDownIcon } from "lucide-react";
import type { SyncSortOrder } from "./sync-monitoring-page";

export const SyncStatusPill = ({ status }: { status: SyncTaskSelect["status"] }) => {
  const styles =
    status === "SUCCESS" ? "bg-green-500/20 text-green-700 dark:text-green-400"
      : status === "FAILED" ? "bg-red-500/20 text-red-700 dark:text-red-400"
        : "bg-brand-cream/40 text-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>
      {status ?? "n/a"}
    </span>
  );
};

export const SyncLogTable = ({
  setPage,
  tasks,
  isLoading,
  sortOrder,
  onSort,
  onRowClick,
}: {
  setPage: React.Dispatch<React.SetStateAction<number>>
  tasks: SyncTaskSelect[],
  isLoading: boolean,
  sortOrder: SyncSortOrder,
  onSort: () => void,
  onRowClick: (task: SyncTaskSelect) => void,
}) => {
  return (
    <Table className="w-full"
      containerClassName="flex-1 min-w-0 h-full max-h-full overflow-auto no-scrollbar border rounded-md">
      <TableHeader className="sticky top-0 z-10 bg-background bg-[linear-gradient(rgba(137,142,211,0.15),rgba(137,142,211,0.15))] shadow-sm">
        <TableRow className="hover:bg-transparent border-b-2 border-brand-purple/40">
          <TableHead>
            Status
          </TableHead>
          <TableHead>
            Step
          </TableHead>
          <TableHead>
            Integration
          </TableHead>
          <TableHead>
            Inputs
          </TableHead>
          <TableHead>
            <button
              type="button"
              onClick={onSort}
              className="flex items-center gap-1 hover:text-foreground"
            >
              Updated
              {sortOrder === "asc" ? <ChevronUpIcon size={12} /> : <ChevronDownIcon size={12} />}
            </button>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="h-full overflow-y-auto no-scrollbar">
        {isLoading ? (
          Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-8 w-[300px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
            </TableRow>
          ))
        ) : (
          tasks.map((task) => {
            const intConfig = configRegistry.find((c) => c.integration === task.integration);
            return (
            <TableRow key={task.id} onClick={() => onRowClick(task)} className="cursor-pointer odd:bg-transparent even:bg-brand-grey/5 hover:bg-brand-purple/10">
              <TableCell>
                <SyncStatusPill status={task.status} />
              </TableCell>
              <TableCell>
                {task.step ?? "n/a"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {intConfig && (
                    <img src={intConfig.icon} alt={intConfig.integration} height={20} width={20} />
                  )}
                  {task.integration}
                </div>
              </TableCell>
              <TableCell>
                <div className="w-[300px] line-clamp-2 font-mono text-xs text-muted-foreground">
                  {task.inputs ? JSON.stringify(task.inputs) : ""}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground tabular-nums">
                {new Date(task.updateDate).toLocaleString()}
              </TableCell>
            </TableRow>
            );
          })
        )}
      </TableBody>
      <TableFooter className="sticky bottom-0 z-20 w-full bg-background bg-[linear-gradient(rgba(137,142,211,0.15),rgba(137,142,211,0.15))] border-t-2 border-brand-purple/40">
        <TableRow>
          <TableCell colSpan={5}>
            <div className="flex items-center gap-4">
              <Button size={"icon-sm"} variant={"outline"} onClick={() => {
                setPage((prev) => {
                  if (prev === 0) return 0;
                  return prev - 1;
                });
              }}>
                <ChevronLeftIcon size={12} />
              </Button>
              <Button size={"icon-sm"} variant={"outline"} onClick={() => {
                setPage((prev) => {
                  if (tasks.length < PAGE_SIZE) return prev;
                  return prev + 1;
                });
              }}>
                <ChevronRightIcon size={12} />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
