import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "@/components/ui/select";
import type { SyncPipelineSelect } from "@/core/db/schema/schema";
import { useEffect, useState } from "react";

export const SyncScheduleDialog = ({
  open,
  onOpenChange,
  integration,
  syncPipeline,
  onSyncPipelineChange,
}: {
  open: boolean,
  onOpenChange: (open: boolean) => void,
  integration: string,
  syncPipeline: SyncPipelineSelect | null,
  onSyncPipelineChange: () => void,
}) => {
  const [frequency, setFrequency] = useState<"NO SCHEDULE" | "DAILY" | "WEEKLY" | "MONTHLY">("NO SCHEDULE");
  const items = ["Daily", "Weekly", "Monthly", "No Schedule"];

  useEffect(() => {
    if (syncPipeline?.frequency) {
      setFrequency(syncPipeline.frequency);
    }
  }, [syncPipeline]);

    const upsertSyncPipeline = async () => {
    if (frequency === "NO SCHEDULE") {
      await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/sync-pipeline/${integration}`, {
        method: "DELETE"
      });
    } else {
      await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/sync-pipeline`, {
        method: "POST",
        body: JSON.stringify({
          integration: integration,
          frequency: frequency
        })
      });
    }
    onSyncPipelineChange();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sync frequency</DialogTitle>
          <DialogDescription>CRON jobs to automatically sync new data</DialogDescription>
        </DialogHeader>
        <Select value={frequency} onValueChange={(value: string) => {
          setFrequency(value as "DAILY" | "WEEKLY" | "MONTHLY" | "NO SCHEDULE");
        }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="No Schedule" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {items.map((item) => (
                <SelectItem key={item} value={item.toUpperCase()}>
                  {item}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <DialogFooter className="justify-start gap-2">
          <Button onClick={async () => {
            await upsertSyncPipeline();
            onOpenChange(false);
          }} >
            Confirm Sync Schedule
          </Button>
          <Button variant="outline" onClick={async () => {
            onOpenChange(false);
          }}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>

    </Dialog>
  );
}
