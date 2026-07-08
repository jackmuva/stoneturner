import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MdArtifactSelect } from "@/core/db/schema/schema"
import { PAGE_SIZE } from "@/lib/constants";
import { ChevronLeftIcon, ChevronRightIcon, ChevronsUpDownIcon, ChevronUpIcon, ChevronDownIcon } from "lucide-react";
import type { ArtifactSortField, SortOrder } from "./integration-data-page";

export const ArtifactTable = ({
  setPage,
  artifacts,
  isLoading,
  sortBy,
  sortOrder,
  onSort,
  onRowClick,
}: {
  setPage: React.Dispatch<React.SetStateAction<number>>
  artifacts: MdArtifactSelect[],
  isLoading: boolean,
  sortBy: ArtifactSortField,
  sortOrder: SortOrder,
  onSort: (field: ArtifactSortField) => void,
  onRowClick: (artifact: MdArtifactSelect) => void,
}) => {
  const SortIcon = ({ field }: { field: ArtifactSortField }) => {
    if (sortBy !== field) return <ChevronsUpDownIcon size={12} className="opacity-50" />;
    return sortOrder === "asc" ? <ChevronUpIcon size={12} /> : <ChevronDownIcon size={12} />;
  };

  const SortableHead = ({ field, children }: { field: ArtifactSortField, children: React.ReactNode }) => (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="flex items-center gap-1 hover:text-foreground"
      >
        {children}
        <SortIcon field={field} />
      </button>
    </TableHead>
  );

  return (
    <Table className="w-full"
      containerClassName="relative flex-1 min-w-0 h-full overflow-auto no-scrollbar border rounded-md">
      <TableHeader className="sticky top-0 z-10 bg-background bg-[linear-gradient(rgba(137,142,211,0.15),rgba(137,142,211,0.15))] shadow-sm">
        <TableRow className="hover:bg-transparent border-b-2 border-brand-purple/40">
          <TableHead>
            Markdown
          </TableHead>
          <SortableHead field="artifactDate">
            Artifact Created
          </SortableHead>
          <TableHead>
            Summary
          </TableHead>
          <TableHead>
            Questions Answered
          </TableHead>
          <TableHead>
            Related Entities
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="h-full">
        {isLoading ? (
          Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-16 w-[300px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-16 w-[300px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-16 w-[300px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-16 w-[300px]" />
              </TableCell>
            </TableRow>
          ))
        ) : artifacts.length > 0 ? (
          artifacts.map((artifact) =>
            <TableRow key={artifact.id} onClick={() => onRowClick(artifact)} className="cursor-pointer odd:bg-transparent even:bg-brand-grey/5 hover:bg-brand-purple/10">
              <TableCell>
                <div className="w-[300px] line-clamp-3 whitespace-pre-line">
                  {(artifact.markdown ?? "").replace(/\\n/g, "\n")}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground tabular-nums">
                {artifact.artifactDate ? (new Date(artifact.artifactDate)).toDateString() : "n/a"}
              </TableCell>
              <TableCell>
                <div className="w-[300px] line-clamp-3 whitespace-pre-line">
                  {artifact.keyPoints}
                </div>
              </TableCell>
              <TableCell>
                <div className="w-[300px] line-clamp-3 whitespace-pre-line">
                  {artifact.questionsAnswered}
                </div>
              </TableCell>
              <TableCell>
                <div className="w-[300px] line-clamp-3 whitespace-pre-line">
                  {artifact.entities ? artifact.entities.join(", ") : ""}
                </div>
              </TableCell>
            </TableRow>
          )
        ) : (
          <TableRow>
            <TableCell colSpan={6}>
              <div className="h-[700px] text-center pt-4">
                No artifacts yet
              </div>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
      <TableFooter className="sticky bottom-0 z-20 w-full bg-background bg-[linear-gradient(rgba(137,142,211,0.15),rgba(137,142,211,0.15))] border-t-2 border-brand-purple/40">
        <TableRow>
          <TableCell colSpan={6}>
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
                  if (artifacts.length < PAGE_SIZE) return prev;
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
