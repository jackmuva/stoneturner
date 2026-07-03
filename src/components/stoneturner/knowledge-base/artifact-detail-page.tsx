import type { MdArtifactSelect } from "@/core/db/schema/schema";
import { useNavigate, useParams } from "react-router-dom";
import useSWR from "swr";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ArtifactDetailSheet } from "./artifact-detail-sheet";

export const ArtifactDetailPage = () => {
  const { artifactId } = useParams();
  const navigate = useNavigate();

  const { data: artifact, isLoading } = useSWR<MdArtifactSelect | null>(
    artifactId ? `artifact/${artifactId}` : null,
    async () => {
      const res = await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/artifact/${artifactId}`, {
        method: "GET",
      });
      const body = await res.json();
      return body.artifact ?? null;
    },
  );

  return (
    <div className="w-full h-full min-w-0 min-h-0 flex flex-col gap-4 p-4 font-sans">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink className="text-base" href="/">
              Knowledge Base
            </BreadcrumbLink>
            {artifact && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbLink className="text-base" href={`/knowledge/data/${artifact.integration}`}>
                  {artifact.integration}
                </BreadcrumbLink>
              </>
            )}
            <BreadcrumbSeparator />
            <BreadcrumbPage className="text-base">
              Artifact
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex-1 min-h-0 flex flex-row">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading artifact...</div>
        ) : artifact ? (
          <ArtifactDetailSheet artifactPreview={artifact} onClose={() => navigate(-1)} fullscreen />
        ) : (
          <div className="text-sm text-muted-foreground">Artifact not found.</div>
        )}
      </div>
    </div>
  );
};
