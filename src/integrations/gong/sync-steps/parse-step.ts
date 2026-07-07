import { getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { getGongCallByCallId, getGongTranscripts } from "../db/queries";
import type { GongCallSelect, GongTranscriptSelect } from "../db/schema";
import { PAGE_SIZE, SUMMARIZATION_MODEL } from "@/lib/constants";
import { generateText, Output } from "ai";
import * as z from "zod";
import { aiGatewayBottleneck } from "@/core/services/rate-limiter";
import type { SqliteDb } from "@/core/models/db-models";

export type GongParseInputs = { offset?: number };

export const parseGongStep = async (_incremental: boolean = false, db: SqliteDb, inputs?: GongParseInputs, syncTaskId?: string) => {
  const offset = inputs?.offset;
  let curOffset: number = offset ?? 0;
  let transcripts: GongTranscriptSelect[] = [];
  let firstIteration = true;

  while (transcripts.length > 0 || firstIteration) {
    firstIteration = false;
    try {
      transcripts = await getGongTranscripts(curOffset, db);
      const results = await Promise.allSettled(
        transcripts.map((t) => aiGatewayBottleneck.schedule(() => generateMdArtifact(t, db)))
      );
      const failures = results
        .filter((r) => r.status === "rejected")
        .map((r) => String((r as PromiseRejectedResult).reason));

      await upsertSyncTask({
        id: syncTaskId,
        integration: "gong",
        status: failures.length ? "FAILED" : "SUCCESS",
        inputs: { offset: curOffset },
        error: failures.length ? JSON.stringify(failures) : null,
        step: "parse",
      }, db);
    } catch (e) {
      await upsertSyncTask({
        id: syncTaskId,
        integration: "gong",
        status: "FAILED",
        inputs: { offset: curOffset },
        error: String(e),
        step: "parse"
      }, db);
    }

    if (offset !== undefined) {
      break;
    } else {
      curOffset += PAGE_SIZE;
    }
  }
}

const generateMdArtifact = async (transcript: GongTranscriptSelect, db: SqliteDb): Promise<void> => {
  const md: string[] = [];
  const call: GongCallSelect | undefined = await getGongCallByCallId(transcript.callId, db);
  if (call) {
    md.push(`# ${call.title}\n\n`);
  }

  const speakerMap: { [id: string]: number } = {};
  let curSpeaker: number = 1;
  if (transcript.transcript) {
    for (const sentence of transcript.transcript) {
      if (!(sentence.speakerId in speakerMap)) {
        speakerMap[String(sentence.speakerId)] = curSpeaker;
        curSpeaker += 1;
      }
      md.push(`Speaker ${speakerMap[String(sentence.speakerId)]}: ${sentence.sentences.map((sen: {
        start: number,
        end: number,
        text: string,
      }) => sen.text).join(" ")}\n\n`);
    }
  }
  const markdown: string = md.join("");

  const existing = await getMdArtifactByIntegrationArtifactId(transcript.callId, db);
  if (!existing || existing.markdown !== markdown) {
    const { output: analysis } = await retry(async () => await generateText({
      model: SUMMARIZATION_MODEL,
      prompt: `Analyze the following transcript and extract three distinct types of information:

1. KEY POINTS: The main takeaways, important concepts, and key ideas discussed in the conversation.
2. QUESTIONS ANSWERED: The key questions or problems this conversation addresses and resolves.
3. ENTITIES: Names of people, companies, tools, papers, products, concepts, and other important entities mentioned.

For each category, provide a comprehensive list with clear, concise entries.

Transcript:
${md.join("")}`,
      output: Output.object({
        schema: z.object({
          keyPoints: z.array(z.string()),
          questionsAnswered: z.array(z.string()),
          entities: z.array(z.string()),
        }),
      }),
    }));

    await upsertMdArtifact({
      integrationArtifactId: transcript.callId,
      integration: "Gong",
      artifactDate: call?.started,
      markdown: md.join(""),
      keyPoints: analysis.keyPoints,
      questionsAnswered: analysis.questionsAnswered,
      entities: analysis.entities,
    }, db);
  }
}
