import type { McpToolResult } from "@/core/models/mcp-models";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// drizzle-orm doesn't export a native `lower`; wrap raw sql so integration
// names (and other text columns) can be compared case-insensitively, e.g.
// `eq(lower(col), value.toLowerCase())`.
export const lower = (column: SQLiteColumn) => sql`lower(${column})`;

export async function retry<T>(func: () => T | Promise<T>, timeouts: number[] = [1, 10, 30, 60], error?: Error): Promise<T> {
  if (timeouts.length === 0 || timeouts[0] === undefined) throw new Error(String(error));
  try {
    const res: T = await func();
    return res;
  } catch (error) {
    console.error("retry function: ", error);
    await new Promise((resolve) => setTimeout(resolve, timeouts[0]! * 1000)
    );
    return await retry(func, timeouts.slice(1), error as Error);
  }
}

export const textResult = (text: string, isError = false): McpToolResult => ({
  content: [{ type: "text", text }],
  isError: isError || undefined,
});


