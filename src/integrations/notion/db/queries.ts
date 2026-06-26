import { notionPage, type NotionPageInsert, type NotionPageSelect, notionPageMarkdown, type NotionPageMarkdownInsert, type NotionPageMarkdownSelect } from './schema';
import { eq, sql } from 'drizzle-orm';
import { PAGE_SIZE } from '@/lib/constants';
import { db } from '@/core/db/db';

export const batchInsertNotionPage = async (pages: NotionPageInsert[]): Promise<void> => {
  await db.insert(notionPage)
    .values(pages)
    .onConflictDoUpdate({
      target: notionPage.pageId,
      set: {
        createdTime: sql`excluded.createdTime`,
        lastEditedTime: sql`excluded.lastEditedTime`,
        createdBy: sql`excluded.createdBy`,
        lastEditedBy: sql`excluded.lastEditedBy`,
        archived: sql`excluded.archived`,
        inTrash: sql`excluded.inTrash`,
        icon: sql`excluded.icon`,
        cover: sql`excluded.cover`,
        properties: sql`excluded.properties`,
        parent: sql`excluded.parent`,
        url: sql`excluded.url`,
        publicUrl: sql`excluded.publicUrl`,
      }
    });
}

export const getNotionPages = async (offset: number = 0): Promise<NotionPageSelect[]> => {
  return await db.select()
    .from(notionPage)
    .limit(PAGE_SIZE)
    .offset(offset);
}

export const getMostRecentEditedTime = async (): Promise<string | null> => {
  const result = await db.select({ lastEditedTime: notionPage.lastEditedTime }).from(notionPage)
    .orderBy(sql`${notionPage.lastEditedTime} desc`)
    .limit(1);

  return result[0]?.lastEditedTime ?? null;
}

export const batchInsertNotionPageMarkdown = async (records: NotionPageMarkdownInsert[]): Promise<void> => {
  await db.insert(notionPageMarkdown)
    .values(records)
    .onConflictDoUpdate({
      target: notionPageMarkdown.pageId,
      set: {
        object: sql`excluded.object`,
        markdown: sql`excluded.markdown`,
        truncated: sql`excluded.truncated`,
        unknownBlockIds: sql`excluded.unknownBlockIds`,
        lastEditedTime: sql`excluded.lastEditedTime`,
      }
    });
}

export const getNotionPageMarkdownById = async (pageId: string): Promise<NotionPageMarkdownSelect | undefined> => {
  const [record] = await db.select().from(notionPageMarkdown).where(eq(notionPageMarkdown.pageId, pageId));
  return record;
}

export const deleteNotionData = async () => {

  await db.delete(notionPage);
  await db.delete(notionPageMarkdown);
}
