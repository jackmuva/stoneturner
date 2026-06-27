import {
  plaudFile, type PlaudFileInsert, type PlaudFileSelect,
  plaudTranscript, type PlaudTranscriptInsert, type PlaudTranscriptSelect,
} from './schema';
import { desc, eq, isNull, sql } from 'drizzle-orm';
import { PAGE_SIZE } from '@/lib/constants';
import { db } from '@/core/db/db';

export const batchInsertPlaudFile = async (files: PlaudFileInsert[]): Promise<void> => {
  if (files.length === 0) return;
  await db.insert(plaudFile)
    .values(files)
    .onConflictDoUpdate({
      target: plaudFile.fileId,
      set: {
        name: sql`excluded.name`,
        createdAt: sql`excluded.createdAt`,
        serialNumber: sql`excluded.serialNumber`,
        startAt: sql`excluded.startAt`,
        duration: sql`excluded.duration`,
      }
    });
}

export const getPlaudFiles = async (offset: number = 0): Promise<PlaudFileSelect[]> => {
  return await db.select()
    .from(plaudFile)
    .limit(PAGE_SIZE)
    .offset(offset);
}

export const getPlaudFileByFileId = async (fileId: string): Promise<PlaudFileSelect | undefined> => {
  const [result] = await db.select().from(plaudFile).where(eq(plaudFile.fileId, fileId));
  return result;
}

export const getLatestPlaudFile = async (): Promise<PlaudFileSelect | null> => {
  const [file] = await db.select()
    .from(plaudFile)
    .orderBy(desc(plaudFile.startAt))
    .limit(1);
  return file ?? null;
}

// Files that don't yet have a transcript row — transcripts are immutable once
// fetched, so this lets the detail step skip files already synced.
export const getPlaudFilesWithoutTranscript = async (offset: number = 0): Promise<PlaudFileSelect[]> => {
  const rows = await db.select()
    .from(plaudFile)
    .leftJoin(plaudTranscript, eq(plaudFile.fileId, plaudTranscript.fileId))
    .where(isNull(plaudTranscript.id))
    .limit(PAGE_SIZE)
    .offset(offset);
  return rows.map((r) => r.plaudFile);
}

export const upsertPlaudTranscript = async (transcripts: PlaudTranscriptInsert[]): Promise<void> => {
  if (transcripts.length === 0) return;
  await db.insert(plaudTranscript)
    .values(transcripts)
    .onConflictDoUpdate({
      target: plaudTranscript.fileId,
      set: {
        name: sql`excluded.name`,
        segments: sql`excluded.segments`,
      }
    });
}

export const getPlaudTranscripts = async (offset: number = 0): Promise<PlaudTranscriptSelect[]> => {
  return await db.select()
    .from(plaudTranscript)
    .limit(PAGE_SIZE)
    .offset(offset);
}

export const deletePlaudData = async (): Promise<void> => {
  await db.delete(plaudTranscript);
  await db.delete(plaudFile);
}
