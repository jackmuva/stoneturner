import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "@/components/ui/select";
import { useState } from "react";

export const SyncScheduleDialog = ({
  open,
  onOpenChange,
  integration,
}: {
  open: boolean,
  onOpenChange: (open: boolean) => void,
  integration: string,
}) => {
  const [frequency, setFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("WEEKLY");
  const items = ["Daily", "Weekly", "Monthly"];

  const deleteSyncSchedule = async () => {
    await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/sync-schedule/${integration}`, {
      method: "DELETE"
    });
  }

  const upsertSyncSchedule = async () => {
    await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/sync-schedule`, {
      method: "POST",
      body: JSON.stringify({
        integration: integration,
        frequency: frequency
      })
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sync frequency</DialogTitle>
          <DialogDescription>CRON jobs to automatically sync new data</DialogDescription>
        </DialogHeader>
        <Select onValueChange={(value: string) => {
          //@ts-ignore
          setFrequency(value.toUpperCase());
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
