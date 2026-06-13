import { gongTranscript, type GongTranscriptInsert, type GongTranscriptSelect, gongCall, type GongCallInsert, type GongCallSelect } from './schema';
import { desc, eq, sql } from 'drizzle-orm';
import { PAGE_SIZE } from '@/lib/constants';
import { db } from '@/core/db/queries';

export const batchInsertGongTranscript = async (transcripts: GongTranscriptInsert[]): Promise<void> => {
  await db.insert(gongTranscript)
    .values(transcripts)
    .onConflictDoUpdate({
      target: gongTranscript.callId,
      set: {
        transcript: sql`excluded.transcript`,
      }
    });
}

export const getGongTranscripts= async (offset: number = 0): Promise<GongTranscriptSelect[]> => {
  return await db.select()
    .from(gongTranscript)
    .limit(PAGE_SIZE)
    .offset(offset);
}

export const getGongTranscriptByCallId = async (callId: string): Promise<GongTranscriptSelect | undefined> => {
  const [result] = await db.select()
    .from(gongTranscript)
    .where(eq(gongTranscript.callId, callId));
  return result;
}

export const batchInsertGongCall = async (calls: GongCallInsert[]): Promise<void> => {
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

export const getGongCallByCallId = async (callId: string): Promise<GongCallSelect | undefined> => {
  const [result] = await db.select()
    .from(gongCall)
    .where(eq(gongCall.callId, callId));
  return result;
}

export const getGongCalls= async (cursor?: number): Promise<GongCallSelect[]> => {
  return await db.select()
    .from(gongCall)
    .limit(50)
    .offset(cursor ? 50 * cursor : 0);
}

export const getLatestGongCall= async (): Promise<GongCallSelect | null> => {
  const [call] = await db.select()
    .from(gongCall)
    .orderBy(gongCall.started, desc(gongCall.started))
    .limit(1);
  return call ?? null;
}
