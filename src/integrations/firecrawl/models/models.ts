export interface FirecrawlCrawlInitiateResponse {
  success: boolean;
  id: string;
  url: string;
}

export interface FirecrawlPageMetadata {
  title?: string | string[];
  description?: string | string[];
  language?: string | string[] | null;
  sourceURL?: string;
  url?: string;
  statusCode?: number;
  error?: string | null;
  modifiedTime?: string;
  publishedTime?: string;
  [key: string]: unknown;
}

export interface FirecrawlPage {
  markdown?: string;
  html?: string | null;
  rawHtml?: string | null;
  links?: string[];
  metadata: FirecrawlPageMetadata;
}

export interface FirecrawlCrawlStatusResponse {
  status: "scraping" | "completed" | "failed" | "cancelled";
  total: number;
  completed: number;
  creditsUsed?: number;
  expiresAt?: string;
  next?: string | null;
  data: FirecrawlPage[];
}
