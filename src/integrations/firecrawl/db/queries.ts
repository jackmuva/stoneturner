import { firecrawlPage, type FirecrawlPageInsert, type FirecrawlPageSelect } from './schema';
import { sql } from 'drizzle-orm';
import { PAGE_SIZE } from '@/lib/constants';
import type { SqliteDb } from '@/core/models/db-models';

const INSERT_CHUNK_SIZE = 100;

export const batchInsertFirecrawlPage = async (pages: FirecrawlPageInsert[], db: SqliteDb): Promise<void> => {
  if (pages.length === 0) return;
  for (let i = 0; i < pages.length; i += INSERT_CHUNK_SIZE) {
    const chunk = pages.slice(i, i + INSERT_CHUNK_SIZE);
    await db.insert(firecrawlPage)
      .values(chunk)
      .onConflictDoUpdate({
        target: firecrawlPage.url,
        set: {
          sourceUrl: sql`excluded.sourceUrl`,
          title: sql`excluded.title`,
          markdown: sql`excluded.markdown`,
          html: sql`excluded.html`,
          crawledAt: sql`excluded.crawledAt`,
        }
      });
  }
}

export const getFirecrawlPages = async (offset: number = 0, db: SqliteDb): Promise<FirecrawlPageSelect[]> => {
  return await db.select()
    .from(firecrawlPage)
    .limit(PAGE_SIZE)
    .offset(offset);
}

export const deleteAllFirecrawlData = async (db: SqliteDb): Promise<void> => {
  await db.delete(firecrawlPage);
}
