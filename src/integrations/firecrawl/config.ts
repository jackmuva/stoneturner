import type { IntegrationConfig } from "@/core/models/models";

export const firecrawlConfig: IntegrationConfig = {
  integration: "firecrawl",
  icon: "/assets/firecrawl.png",
  integrationType: "BASIC_TOKEN", // reuses accessKey for the API key; no new save path
  description: "Crawl websites into searchable markdown via Firecrawl. Enter your API key from the [Firecrawl dashboard](https://www.firecrawl.dev/app/api-keys) and the URLs to crawl.",
  inputs: [
    { input: "accessKey", label: "Firecrawl API Key" },
  ],
  optionInputs: [
    { key: "urls", label: "URLs to crawl (comma-separated)" },
    { key: "maxDepth", label: "Max crawl depth" },
    { key: "limit", label: "Max pages to crawl" },
  ],
};
