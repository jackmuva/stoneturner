import { gongTranscript, type GongTranscriptInsert, type GongTranscriptSelect, gongCall, type GongCallInsert, type GongCallSelect } from './schema';
import { desc, eq, sql } from 'drizzle-orm';
import { PAGE_SIZE } from '@/lib/constants';
import type { SqliteDb } from '@/core/models/db-models';

export const batchInsertGongTranscript = async (transcripts: GongTranscriptInsert[], db: SqliteDb): Promise<void> => {
  await db.insert(gongTranscript)
    .values(transcripts)
    .onConflictDoUpdate({
      target: gongTranscript.callId,
      set: {
        transcript: sql`excluded.transcript`,
      }
    });
}

export const getGongTranscripts= async (offset: number = 0, db: SqliteDb): Promise<GongTranscriptSelect[]> => {
  return await db.select()
    .from(gongTranscript)
    .limit(PAGE_SIZE)
    .offset(offset);
}

export const getGongTranscriptByCallId = async (callId: string, db: SqliteDb): Promise<GongTranscriptSelect | undefined> => {
  const [result] = await db.select()
    .from(gongTranscript)
    .where(eq(gongTranscript.callId, callId));
  return result;
}

export const batchInsertGongCall = async (calls: GongCallInsert[], db: SqliteDb): Promise<void> => {
  await db.insert(gongCall)
    .values(calls)
    .onConflictDoUpdate({
      target: gongCall.callId,
      set: {
        url: sql`excluded.url`,
        title: sql`excluded.title`,
        scheduled: sql`excluded.scheduled`,
        started: sql`excluded.started`,
        duration: sql`excluded.duration`,
        primaryUserId: sql`excluded.primaryUserId`,
        direction: sql`excluded.direction`,
        system: sql`excluded.system`,
        scope: sql`excluded.scope`,
        media: sql`excluded.media`,
        language: sql`excluded.language`,
        workspaceId: sql`excluded.workspaceId`,
        sdrDisposition: sql`excluded.sdrDisposition`,
        clientUniqueId: sql`excluded.clientUniqueId`,
        customData: sql`excluded.customData`,
        purpose: sql`excluded.purpose`,
        meetingUrl: sql`excluded.meetingUrl`,
        isPrivate: sql`excluded.isPrivate`,
        calendarEventId: sql`excluded.calendarEventId`,
      }
    });
}

export const getGongCallByCallId = async (callId: string, db: SqliteDb): Promise<GongCallSelect | undefined> => {
  const [result] = await db.select()
    .from(gongCall)
    .where(eq(gongCall.callId, callId));
  return result;
}

export const getGongCalls= async (cursor: number | undefined, db: SqliteDb): Promise<GongCallSelect[]> => {
  return await db.select()
    .from(gongCall)
    .limit(50)
    .offset(cursor ? 50 * cursor : 0);
}

export const getLatestGongCall= async (db: SqliteDb): Promise<GongCallSelect | null> => {
  const [call] = await db.select()
    .from(gongCall)
    .orderBy(gongCall.started, desc(gongCall.started))
    .limit(1);
  return call ?? null;
}

export const deleteAllGongData = async (db: SqliteDb): Promise<void> => {
  await db.delete(gongTranscript);
  await db.delete(gongCall);
}

export const deleteGongDataByCallId = async (callId: string, db: SqliteDb): Promise<void> => {
  await db.delete(gongTranscript).where(eq(gongTranscript.callId, callId));
  await db.delete(gongCall).where(eq(gongCall.callId, callId));
}
