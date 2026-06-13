import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function retry<T>(func: () => T | Promise<T>, maxAttempt: number = 3, attempt: number = 1, error?: Error): Promise<T> {
  if (attempt > maxAttempt) throw new Error(String(error));
  try {
    const res: T = await func();
    return res;
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 5) * (attempt + 5))
    );
    return await retry(func, maxAttempt, attempt + 1, error as Error);
  }
}

