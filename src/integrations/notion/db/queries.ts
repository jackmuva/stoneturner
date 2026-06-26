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

export const getMostRecentEditedTime = async (): Promise<string | null> => {
  const result = await db.select({ lastEditedTime: notionPage.lastEditedTime }).from(notionPage)
    .orderBy(sql`${notionPage.lastEditedTime} desc`)
    .limit(1);

  return result[0]?.lastEditedTime ?? null;
}

export const batchInsertNotionBlock = async (blocks: NotionBlockInsert[]): Promise<void> => {
  await db.insert(notionBlock)
    .values(blocks)
    .onConflictDoUpdate({
      target: notionBlock.blockId,
      set: {
        type: sql`excluded.type`,
        hasChildren: sql`excluded.hasChildren`,
        text: sql`excluded.text`,
        lastEditedTime: sql`excluded.lastEditedTime`,
        nextCursor: sql`excluded.nextCursor`,
        hasMore: sql`excluded.hasMore`,
        childrenBlockIds: sql`excluded.childrenBlockIds`,
      }
    });
}

export const appendNotionBlockChildren = async (
  blockId: string,
  childrenBlockIds: string[],
  cursor: { nextCursor: string | null; hasMore: boolean },
): Promise<void> => {
  const existing = await db.select().from(notionBlock)
    .where(eq(notionBlock.blockId, blockId))
    .limit(1);

  const merged = [...new Set([...(existing[0]?.childrenBlockIds ?? []), ...childrenBlockIds])];

  await db.update(notionBlock).set({
    childrenBlockIds: merged,
    nextCursor: cursor.nextCursor,
    hasMore: cursor.hasMore,
  }).where(sql`"blockId" = ${blockId}`);
}

export const getNotionBlocks = async (offset: number = 0): Promise<NotionBlockSelect[]> => {
  return await db.select().from(notionBlock).limit(PAGE_SIZE).offset(offset);
}

export const getNotionBlockById = async (id: string): Promise<NotionBlockSelect | undefined> => {
  const [block] = await db.select().from(notionBlock).where(eq(notionBlock.blockId, id));
  return block;
}

export const deleteNotionData = async () => {

  await db.delete(notionPage);
  await db.delete(notionBlock);
}
