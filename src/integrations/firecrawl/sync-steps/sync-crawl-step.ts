import { getIntegrationCredentialByIntegration, upsertSyncTask } from "@/core/db/queries/queries";
import { db } from "@/core/db/db";
import type { IntegrationCredential } from "@/core/db/schema/schema";
import { retry } from "@/lib/utils";
import { batchInsertFirecrawlPage } from "../db/queries";
import type { FirecrawlPageInsert } from "../db/schema";
import type {
  FirecrawlCrawlInitiateResponse,
  FirecrawlCrawlStatusResponse,
  FirecrawlPage,
} from "../models/models";

const FIRECRAWL_API = "https://api.firecrawl.dev/v2/crawl";
const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_ATTEMPTS = 360; // ~1 hour cap

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface FirecrawlCredentials {
  apiKey: string | null | undefined;
  urls: string[];
  maxDepth: number | undefined;
  limit: number | undefined;
}

export const getCredentials = async (): Promise<FirecrawlCredentials> => {
  const cred: IntegrationCredential | undefined = await getIntegrationCredentialByIntegration("Firecrawl", db);
  const options = cred?.options ?? {};
  const urls = (options.urls ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  const maxDepth = Number(options.maxDepth);
  const limit = Number(options.limit);
  return {
    apiKey: cred?.accessKey,
    urls,
    maxDepth: Number.isFinite(maxDepth) ? maxDepth : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  };
}

const firstString = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return value;
}

const toPageInserts = (pages: FirecrawlPage[], seedUrl: string, crawledAt: string): FirecrawlPageInsert[] => {
  return pages
    .map((page) => {
      const url = page.metadata?.sourceURL ?? page.metadata?.url ?? seedUrl;
      return {
        url,
        sourceUrl: seedUrl,
        title: firstString(page.metadata?.title) ?? null,
        markdown: page.markdown ?? null,
        html: page.html ?? null,
        crawledAt,
      };
    })
    // Guard against duplicate urls within a single insert batch (onConflict targets a single row).
    .filter((page, index, all) => all.findIndex((p) => p.url === page.url) === index);
}

const initiateCrawl = async (apiKey: string, url: string, maxDepth?: number, limit?: number): Promise<FirecrawlCrawlInitiateResponse> => {
  const body: Record<string, unknown> = { url };
  if (maxDepth !== undefined) body.maxDiscoveryDepth = maxDepth;
  if (limit !== undefined) body.limit = limit;

  const res: Response = await retry(async () => await fetch(FIRECRAWL_API, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }), 3, 1);

  return (await res.json()) as FirecrawlCrawlInitiateResponse;
}

const fetchCrawlStatus = async (apiKey: string, statusUrl: string): Promise<FirecrawlCrawlStatusResponse> => {
  const res: Response = await retry(async () => await fetch(statusUrl, {
    method: "GET",
    headers: { "Authorization": `Bearer ${apiKey}` },
  }), 2, 1);
  return (await res.json()) as FirecrawlCrawlStatusResponse;
}

// Crawl one seed URL: initiate, poll to completion, persist pages (following `next` pagination).
const crawlUrl = async (apiKey: string, seedUrl: string, maxDepth?: number, limit?: number): Promise<void> => {
  try {
    const initiated = await initiateCrawl(apiKey, seedUrl, maxDepth, limit);
    if (!initiated.success || !initiated.id) {
      throw new Error(`crawl initiation failed for ${seedUrl}: ${JSON.stringify(initiated)}`);
    }

    const crawledAt = new Date().toISOString();
    let pageCount = 0;

    // Poll until the crawl reaches a terminal state.
    let statusUrl = `${FIRECRAWL_API}/${initiated.id}`;
    let terminal: FirecrawlCrawlStatusResponse | null = null;
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      const status = await fetchCrawlStatus(apiKey, statusUrl);
      if (status.status === "failed" || status.status === "cancelled") {
        throw new Error(`crawl ${initiated.id} ended with status "${status.status}"`);
      }
      if (status.status === "completed") {
        terminal = status;
        break;
      }
      await sleep(POLL_INTERVAL_MS);
    }
    if (!terminal) {
      throw new Error(`crawl ${initiated.id} timed out after ${MAX_POLL_ATTEMPTS} polls`);
    }

    // Persist the first page of results, then follow `next` for >10MB responses.
    let batch: FirecrawlCrawlStatusResponse | null = terminal;
    while (batch) {
      const inserts = toPageInserts(batch.data ?? [], seedUrl, crawledAt);
      await batchInsertFirecrawlPage(inserts);
      pageCount += inserts.length;
      if (!batch.next) break;
      batch = await fetchCrawlStatus(apiKey, batch.next);
    }

    await upsertSyncTask({
      integration: "Firecrawl",
      status: "SUCCESS",
      inputs: JSON.stringify({ url: seedUrl, pages: pageCount }),
      step: "firecrawl-sync-crawl",
    }, db);
  } catch (e) {
    await upsertSyncTask({
      integration: "Firecrawl",
      status: "FAILED",
      inputs: JSON.stringify({ url: seedUrl, error: String(e) }),
      step: "firecrawl-sync-crawl",
    }, db);
  }
}

export const syncFirecrawlCrawlStep = async (_incremental: boolean = false): Promise<void> => {
  const { apiKey, urls, maxDepth, limit } = await getCredentials();

  if (!apiKey || urls.length === 0) {
    await upsertSyncTask({
      integration: "Firecrawl",
      status: "FAILED",
      inputs: JSON.stringify({ error: "missing API key or URLs in credential options" }),
      step: "firecrawl-sync-crawl",
    }, db);
    return;
  }

  // Firecrawl has no "changed-since" API, so every sync re-crawls all URLs.
  // Upserts on the page URL keep re-crawls idempotent.
  for (const url of urls) {
    await crawlUrl(apiKey, url, maxDepth, limit);
  }
}
