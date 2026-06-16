import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MdArtifactSelect } from "@/core/db/schema/schema"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

export const ArtifactTable = ({
  setPage,
  artifacts,
  isLoading,
}: {
  setPage: React.Dispatch<React.SetStateAction<number>>
  artifacts: MdArtifactSelect[],
  isLoading: boolean,
}) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            Markdown
          </TableHead>
          <TableHead>
            Update Date
          </TableHead>
          <TableHead>
            Artifact Created Date
          </TableHead>
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
      <TableBody>
        {isLoading ? (
          <div> Loading...</div>
        ) : (
          artifacts.map((artifact) =>
            <TableRow>
              <TableCell className="max-w-96 overflow-y-auto">
                {artifact.markdown}
              </TableCell>
              <TableCell>
                {artifact.updateDate}
              </TableCell>
              <TableCell>
                {artifact.artifactDate}
              </TableCell>
              <TableCell>
                {artifact.keyPoints}
              </TableCell>
              <TableCell>
                {artifact.questionsAnswered}
              </TableCell>
              <TableCell>
                {artifact.entities}
              </TableCell>
            </TableRow>
          )
        )}
      </TableBody>
      <TableFooter className="flex w-full px-4 py-2 justify-between items-center">
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
            if (artifacts.length < 50) return prev;
            return prev + 1;
          });
        }}>
          <ChevronRightIcon size={12} />
        </Button>
      </TableFooter>
    </Table>
  );
}
