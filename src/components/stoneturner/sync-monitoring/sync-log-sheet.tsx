import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SyncTaskSelect } from "@/core/db/schema/schema";
import { configRegistry } from "@/integrations/config-registry";
import { SyncStatusPill } from "./sync-log-table";

export const SyncLogSheet = ({
  task,
  onClose,
}: {
  task: SyncTaskSelect | null;
  onClose: () => void;
}) => {
  if (!task) return null;

  const intConfig = configRegistry.find((c) => c.integration === task.integration);
  const inputs = task.inputs ? JSON.stringify(task.inputs, null, 2) : "";

  return (
    <div className="h-full min-h-0 w-1/2 flex flex-col border rounded-xs overflow-hidden bg-background">
      <div className="flex flex-col gap-2 p-4 border-b">
        <div className="flex items-center gap-2">
          {intConfig && (
            <img src={intConfig.icon} alt={intConfig.integration} height={24} width={24} />
          )}
          <span className="font-semibold text-foreground">{task.integration}</span>
          <SyncStatusPill status={task.status} />
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            onClick={onClose}
          >
            <XIcon size={16} />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <span>
            Updated: <span className="tabular-nums">{new Date(task.updateDate).toLocaleString()}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-4 p-4 overflow-auto">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Step</span>
          <span className="text-sm text-foreground">{task.step ?? "n/a"}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Status</span>
          <span className="text-sm text-foreground">{task.status ?? "n/a"}</span>
        </div>
        <div className="flex flex-col gap-1 min-h-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Inputs</span>
          {inputs ? (
            <pre className="overflow-auto rounded-md bg-muted p-3 text-xs font-mono text-foreground whitespace-pre-wrap break-words">
              {inputs}
            </pre>
          ) : (
            <span className="text-sm text-muted-foreground">No inputs.</span>
          )}
        </div>
      </div>
    </div>
  );
};
