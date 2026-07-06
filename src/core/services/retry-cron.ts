import type { SyncTaskInsert } from "@/core/db/schema/schema";
import { PAGE_SIZE } from "@/lib/constants";
import { getSyncTasksByStatus, incrementSyncTaskRetries } from "../db/queries/queries";
import type { SyncTaskSelect } from "../db/schema/schema";
import type { SqliteDb } from "../models/db-models";
import { getStepFn } from "@/integrations/step-registry";

const MAX_RETRIES = 3;

const isRetriable = (task: SyncTaskSelect): boolean =>
  Boolean(task.step) && (task.retries ?? 0) < MAX_RETRIES && Boolean(getStepFn(task.integration, task.step!));

export const retryFailedTasks = async (db: SqliteDb) => {
  let offset = 0;
  let failedTasks: SyncTaskSelect[] | undefined = await getSyncTasksByStatus("FAILED", offset, "desc", db);

  while (failedTasks && failedTasks.length > 0) {
    const retriedTaskIds: string[] = [];

    await Promise.allSettled(failedTasks.map(async (task) => {
      if (!isRetriable(task)) return;

      const stepFunc = getStepFn(task.integration, task.step!)!;
      retriedTaskIds.push(task.id);

      try {
        await stepFunc(db, task.inputs, task.id);
      } catch (e) {
        console.error(`retry failed for ${task.integration}/${task.step} (${task.id}):`, e);
      }
    }));

    console.log("incrementing");
    await incrementSyncTaskRetries(retriedTaskIds, db);
    console.log("done");

    offset += PAGE_SIZE;
    failedTasks = await getSyncTasksByStatus("FAILED", offset, "desc", db);
  }
};

/** Helpers for mapping persisted syncTask.inputs to step resume arguments. */

export const withSyncTaskId = (data: SyncTaskInsert, syncTaskId?: string): SyncTaskInsert =>
  syncTaskId ? { ...data, id: syncTaskId } : data;

export const asInputs = (inputs?: unknown): Record<string, unknown> | undefined => {
  if (inputs == null) return undefined;
  if (typeof inputs === "object" && !Array.isArray(inputs)) {
    return inputs as Record<string, unknown>;
  }
  return undefined;
};

export const resumeCursor = (inputs?: unknown): unknown => {
  const obj = asInputs(inputs);
  if (!obj || !("cursor" in obj)) return undefined;
  return obj.cursor;
};

export const resumeOffset = (inputs?: unknown): number | undefined => {
  const obj = asInputs(inputs);
  if (!obj) return undefined;
  if (typeof obj.offset === "number") return obj.offset;
  const cursor = obj.cursor;
  if (typeof cursor === "number") return cursor;
  if (cursor && typeof cursor === "object" && typeof (cursor as { offset?: unknown }).offset === "number") {
    return (cursor as { offset: number }).offset;
  }
  return undefined;
};

export const resumeStringCursor = (inputs?: unknown): string | undefined => {
  const cursor = resumeCursor(inputs);
  return typeof cursor === "string" ? cursor : undefined;
};
