import type { SyncTaskInsert } from "@/core/db/schema/schema";

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
