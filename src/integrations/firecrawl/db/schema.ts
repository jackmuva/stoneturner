import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const firecrawlPage = sqliteTable("firecrawlPage", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  url: text("url").unique().notNull(),       // canonical page URL — stable key
  sourceUrl: text("sourceUrl"),              // seed URL this page was crawled from
  title: text("title"),
  markdown: text("markdown"),
  html: text("html"),
  crawledAt: text("crawledAt"),
},
  (table) => [
    uniqueIndex("firecrawlPage_url_unique_idx").on(table.url),
  ]);

export type FirecrawlPageSelect = InferSelectModel<typeof firecrawlPage>;
export type FirecrawlPageInsert = InferInsertModel<typeof firecrawlPage>;
