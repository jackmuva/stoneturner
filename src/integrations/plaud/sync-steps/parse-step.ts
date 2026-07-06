import { getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import { withSyncTaskId } from "@/core/services/retry-cron";
import { retry } from "@/lib/utils";
import { PAGE_SIZE, SUMMARIZATION_MODEL } from "@/lib/constants";
import { generateText, Output } from "ai";
import * as z from "zod";
import { aiGatewayBottleneck } from "@/core/services/rate-limiter";
import { getPlaudFileByFileId, getPlaudTranscripts } from "../db/queries";
import type { PlaudTranscriptSelect } from "../db/schema";
import type { SqliteDb } from "@/core/models/db-models";

export const parsePlaudStep = async (db: SqliteDb, offset?: number, syncTaskId?: string): Promise<void> => {
  let curOffset: number = offset ?? 0;
  let transcripts: PlaudTranscriptSelect[] = [];
  let firstIteration = true;

  while (transcripts.length > 0 || firstIteration) {
    firstIteration = false;
    try {
      transcripts = await getPlaudTranscripts(curOffset, db);
      const results = await Promise.allSettled(
        transcripts.map((t) => aiGatewayBottleneck.schedule(() => generateMdArtifact(t, db)))
      );
      const failures = results
        .filter((r) => r.status === "rejected")
        .map((r) => String((r as PromiseRejectedResult).reason));

      await upsertSyncTask(withSyncTaskId({
        integration: "plaud",
        status: failures.length ? "FAILED" : "SUCCESS",
        inputs: { offset: curOffset },
        error: failures.length ? JSON.stringify(failures) : undefined,
        step: "parse",
      }, syncTaskId), db);
    } catch (e) {
      await upsertSyncTask(withSyncTaskId({
        integration: "plaud",
        status: "FAILED",
        inputs: { offset: curOffset },
        error: String(e),
        step: "parse",
      }, syncTaskId), db);
    }

    if (offset !== undefined) {
      break;
    } else {
      curOffset += PAGE_SIZE;
    }
  }
}

const generateMdArtifact = async (transcript: PlaudTranscriptSelect, db: SqliteDb): Promise<void> => {
  const file = await getPlaudFileByFileId(transcript.fileId, db);

  const md: string[] = [];
  md.push(`# ${transcript.name ?? file?.name ?? "Plaud Recording"}\n\n`);

  const speakerMap: { [speaker: string]: number } = {};
  let curSpeaker = 1;
  for (const segment of transcript.segments ?? []) {
    const speaker = segment.speaker ?? "Unknown";
    if (!(speaker in speakerMap)) {
      speakerMap[speaker] = curSpeaker;
      curSpeaker += 1;
    }
    md.push(`Speaker ${speakerMap[speaker]}: ${segment.content}\n\n`);
  }
  const markdown: string = md.join("");

  const existing = await getMdArtifactByIntegrationArtifactId(transcript.fileId, db);
  if (existing && existing.markdown === markdown) return;

  const { output: analysis } = await retry(async () => await generateText({
    model: SUMMARIZATION_MODEL,
    prompt: `Analyze the following transcript and extract three distinct types of information:

1. KEY POINTS: The main takeaways, important concepts, and key ideas discussed in the conversation.
2. QUESTIONS ANSWERED: The key questions or problems this conversation addresses and resolves.
3. ENTITIES: Names of people, companies, tools, papers, products, concepts, and other important entities mentioned.

For each category, provide a comprehensive list with clear, concise entries.

Transcript:
${markdown}`,
    output: Output.object({
      schema: z.object({
        keyPoints: z.array(z.string()),
        questionsAnswered: z.array(z.string()),
        entities: z.array(z.string()),
      }),
    }),
  }));

  await upsertMdArtifact({
    integrationArtifactId: transcript.fileId,
    integration: "Plaud",
    artifactDate: file?.startAt ?? undefined,
    markdown,
    keyPoints: analysis.keyPoints,
    questionsAnswered: analysis.questionsAnswered,
    entities: analysis.entities,
  }, db);
}
