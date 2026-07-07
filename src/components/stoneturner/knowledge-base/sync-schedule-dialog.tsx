import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "@/components/ui/select";
import type { SyncScheduleSelect } from "@/core/db/schema/schema";
import { useEffect, useState } from "react";

export const SyncScheduleDialog = ({
  open,
  onOpenChange,
  integration,
  syncSchedule,
  onSyncScheduleChange,
}: {
  open: boolean,
  onOpenChange: (open: boolean) => void,
  integration: string,
  syncSchedule: SyncScheduleSelect | null,
  onSyncScheduleChange: () => void,
}) => {
  const [frequency, setFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("WEEKLY");
  const items = ["Daily", "Weekly", "Monthly"];

  useEffect(() => {
    if (syncSchedule?.frequency) {
      setFrequency(syncSchedule.frequency);
    }
  }, [syncSchedule]);

  const deleteSyncSchedule = async () => {
    await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/sync-schedule/${integration}`, {
      method: "DELETE"
    });
    onSyncScheduleChange();
  }

  const upsertSyncSchedule = async () => {
    await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/sync-schedule`, {
      method: "POST",
      body: JSON.stringify({
        integration: integration,
        frequency: frequency
      })
    });
    onSyncScheduleChange();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sync frequency</DialogTitle>
          <DialogDescription>CRON jobs to automatically sync new data</DialogDescription>
        </DialogHeader>
        <Select value={frequency} onValueChange={(value: string) => {
          setFrequency(value as "DAILY" | "WEEKLY" | "MONTHLY");
        }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Weekly" />
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
            await upsertSyncSchedule();
            onOpenChange(false);
          }} >
            Confirm Sync Schedule
          </Button>
          <Button variant="outline" onClick={async () => {
            await deleteSyncSchedule();
            onOpenChange(false);
          }}>
            Cancel Sync Schedule
          </Button>
        </DialogFooter>
      </DialogContent>

    </Dialog>
  );
}
