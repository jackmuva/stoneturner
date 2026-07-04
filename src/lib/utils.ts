import type { McpToolResult } from "@/core/models/mcp-models";
import { RETRY_BACKOFF_BASE_MS, RETRY_BACKOFF_OFFSET } from "@/lib/constants";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

export type RetryOptions = {
  maxAttempt?: number;
  backoffBaseMs?: number;
  backoffOffset?: number;
};

type NormalizedRetryOptions = Required<RetryOptions>;

function normalizeRetryOptions(options: RetryOptions | number): NormalizedRetryOptions {
  const merged = typeof options === "number" ? { maxAttempt: options } : options;
  return {
    maxAttempt: merged.maxAttempt ?? 3,
    backoffBaseMs: merged.backoffBaseMs ?? RETRY_BACKOFF_BASE_MS,
    backoffOffset: merged.backoffOffset ?? RETRY_BACKOFF_OFFSET,
  };
}

export function retryBackoffMs(
  attempt: number,
  backoffBaseMs: number = RETRY_BACKOFF_BASE_MS,
  backoffOffset: number = RETRY_BACKOFF_OFFSET,
): number {
  const factor = attempt + backoffOffset;
  return backoffBaseMs * factor * factor;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// drizzle-orm doesn't export a native `lower`; wrap raw sql so integration
// names (and other text columns) can be compared case-insensitively, e.g.
// `eq(lower(col), value.toLowerCase())`.
export const lower = (column: SQLiteColumn) => sql`lower(${column})`;

export async function retry<T>(
  func: () => T | Promise<T>,
  options: RetryOptions | number = {},
  attempt: number = 1,
  error?: Error,
): Promise<T> {
  const { maxAttempt, backoffBaseMs, backoffOffset } = normalizeRetryOptions(options);
  if (attempt > maxAttempt) throw new Error(String(error));
  try {
    const res: T = await func();
    return res;
  } catch (error) {
    console.error("retry function: ", error);
    await new Promise((resolve) =>
      setTimeout(resolve, retryBackoffMs(attempt, backoffBaseMs, backoffOffset)),
    );
    return await retry(func, { maxAttempt, backoffBaseMs, backoffOffset }, attempt + 1, error as Error);
  }
}

export const textResult = (text: string, isError = false): McpToolResult => ({
  content: [{ type: "text", text }],
  isError: isError || undefined,
});


