import { notionPage, type NotionPageInsert, type NotionPageSelect, notionBlock, type NotionBlockInsert, type NotionBlockSelect } from './schema';
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

export const batchInsertNotionBlock = async (blocks: NotionBlockInsert[]): Promise<void> => {
  await db.insert(notionBlock)
    .values(blocks)
    .onConflictDoUpdate({
      target: notionBlock.blockId,
      set: {
        type: sql`excluded.type`,
        parent: sql`excluded.parent`,
        createdTime: sql`excluded.createdTime`,
        lastEditedTime: sql`excluded.lastEditedTime`,
        createdBy: sql`excluded.createdBy`,
        lastEditedBy: sql`excluded.lastEditedBy`,
        archived: sql`excluded.archived`,
        inTrash: sql`excluded.inTrash`,
        hasChildren: sql`excluded.hasChildren`,
        content: sql`excluded.content`,
      }
    });
}

export const getNotionBlocks = async (offset: number = 0): Promise<NotionBlockSelect[]> => {
  return await db.select()
    .from(notionBlock)
    .limit(PAGE_SIZE)
    .offset(offset);
}

export const deleteNotionData = async() => {

  await db.delete(notionPage);
  await db.delete(notionBlock);
}
