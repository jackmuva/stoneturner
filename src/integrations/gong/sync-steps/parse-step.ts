import { getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { getGongCallByCallId, getGongTranscripts } from "../db/queries";
import type { GongCallSelect, GongTranscriptSelect } from "../db/schema";
import { PAGE_SIZE, SUMMARIZATION_MODEL, MAX_WORKERS } from "@/lib/constants";
import { generateText, Output } from "ai";
import * as z from "zod";

export const parseGongStep= async (offset: number = 0) => {
  let curOffset: number = offset;
  let transcriptLengths: number[] = [];

  while (transcriptLengths.filter((len: number) => len < PAGE_SIZE).length === 0) {
    const offsets: number[] = [];
    for (let i = 0; i < MAX_WORKERS; i++) {
      offsets.push(curOffset + i * PAGE_SIZE);
    }
    const transcriptsList = await Promise.allSettled(
      offsets.map((offset) => fetchTranscripts(offset))
    );

    await Promise.allSettled(
      transcriptsList
        .map((transcripts, i) => { return { transcripts, i } })
        .filter((transcriptsObj) => transcriptsObj.transcripts.status === "fulfilled")
        .map((transcriptsObj) => generateMdArtifacts(offsets[transcriptsObj.i]!, transcriptsObj.transcripts.status === "fulfilled" ? transcriptsObj.transcripts.value : [])
        )
    );

    transcriptLengths = transcriptsList.map((transcripts) => {
      return transcripts.status === "fulfilled" ? transcripts.value.length : PAGE_SIZE;
    });

    curOffset += MAX_WORKERS * PAGE_SIZE;
  }
}

const fetchTranscripts = async (offset: number): Promise<GongTranscriptSelect[]> => {
  return await getGongTranscripts(offset);
}

const generateMdArtifacts = async (curOffset: number, transcripts: GongTranscriptSelect[]): Promise<void> => {
  try {
    for (const transcript of transcripts) {
      const md: string[] = [];
      const call: GongCallSelect | undefined = await getGongCallByCallId(transcript.callId);
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

      const existing = await getMdArtifactByIntegrationArtifactId(transcript.callId);
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
        }), 3, 1);

        await upsertMdArtifact({
          integrationArtifactId: transcript.callId,
          integration: "Gong",
          artifactDate: call?.started,
          markdown: md.join(""),
          keyPoints: analysis.keyPoints,
          questionsAnswered: analysis.questionsAnswered,
          entities: analysis.entities,
        });
      }
    }

    await upsertSyncTask({
      integration: "Gong",
      status: "SUCCESS",
      inputs: JSON.stringify({ offset: curOffset }),
      step: "parse"
    });
  } catch (e) {
    await upsertSyncTask({
      integration: "Gong",
      status: "FAILED",
      inputs: JSON.stringify({ offset: curOffset }),
      step: "parse"
    });
  }
}
