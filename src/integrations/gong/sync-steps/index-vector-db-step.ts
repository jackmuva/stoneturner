import { getMdArtifactByIntegrationAndUserId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import type { MdArtifactSelect } from "@/core/db/schema/schema";
import { getChromaCollection, getKeyPointsCollection, getQuestionsAnsweredCollection } from "@/core/services/chroma";
import { PAGE_SIZE, MAX_WORKERS} from "@/lib/constants";
import { retry } from "@/lib/utils";

export const indexVectorDbStep= async (offset: number = 0) => {
  let curOffset: number = offset;
  let artifactLengths: number[] = [];

  while (artifactLengths.filter((len: number) => len < PAGE_SIZE).length === 0) {
    const offsets: number[] = [];
    for (let i = 0; i < MAX_WORKERS; i++) {
      offsets.push(curOffset + i * PAGE_SIZE);
    }

    const artifactsList = await Promise.allSettled(
      offsets.map((offset) => getMdArtifacts(offset))
    );

    await Promise.allSettled(
      artifactsList
        .map((artifacts, i) => { return { artifacts: artifacts, index: i } })
        .filter((artifactObj) => artifactObj.artifacts.status === "fulfilled")
        .map((artifactObj) => chunkMd(artifactObj.artifacts.status === "fulfilled" ? artifactObj.artifacts.value : [], offsets[artifactObj.index]!))
    );

    artifactLengths = artifactsList.map((artifacts) => {
      return artifacts.status === "fulfilled" ? artifacts.value.length : PAGE_SIZE;
    });

    curOffset += MAX_WORKERS * PAGE_SIZE;
  }
}

export const getMdArtifacts = async (offset: number): Promise<MdArtifactSelect[]> => {
  return await getMdArtifactByIntegrationAndUserId("Gong", offset)
}

export const chunkMd = async (artifacts: MdArtifactSelect[], curOffset: number) => {
  for (const artifact of artifacts) {
    try {
      if (!artifact.markdown || artifact.lastIndex) continue;

      const lines = artifact.markdown.split("\n").filter((line) => line.trim() !== "");
      const chunks = chunkLines(lines, 250);

      if (chunks.length === 0) continue;

      const chromaCollection = await getChromaCollection();
      const qaCollection = await getQuestionsAnsweredCollection();
      const kpCollection = await getKeyPointsCollection();

      await Promise.all([
        retry(async () => await chromaCollection.upsert({
          ids: chunks.map((c) => `${artifact.id}-lines-${c.startLine}-${c.endLine}`),
          documents: chunks.map((c) => c.text),
          metadatas: chunks.map(() => ({
            integrationArtifactId: artifact.integrationArtifactId,
            integration: artifact.integration,
            artifactDate: (new Date(artifact.artifactDate!)).getTime(),
            updateDate: (new Date(artifact.updateDate)).getTime(),
            entities: artifact.entities,
          })),
        }), 3, 1),
        retry(async () => {
          if (!artifact.questionsAnswered || artifact.questionsAnswered.length === 0) return;
          await qaCollection.upsert({
            ids: (artifact.questionsAnswered || []).map((_, i) => `${artifact.id}-${i}`),
            documents: artifact.questionsAnswered || [],
            metadatas: (artifact.questionsAnswered || []).map(() => ({
              integrationArtifactId: artifact.integrationArtifactId,
              integration: artifact.integration,
              artifactDate: (new Date(artifact.artifactDate!)).getTime(),
              updateDate: (new Date(artifact.updateDate)).getTime(),
              entities: artifact.entities,
            }))
          })
        }, 3, 1),
        retry(async () => {
          if (!artifact.keyPoints || artifact.keyPoints.length === 0) return;
          await kpCollection.upsert({
            ids: (artifact.keyPoints || []).map((_, i) => `${artifact.id}-${i}`),
            documents: artifact.keyPoints || [],
            metadatas: (artifact.keyPoints || []).map(() => ({
              integrationArtifactId: artifact.integrationArtifactId,
              integration: artifact.integration,
              artifactDate: (new Date(artifact.artifactDate!)).getTime(),
              updateDate: (new Date(artifact.updateDate)).getTime(),
              entities: artifact.entities,
            })),
          })
        }, 3, 1),
      ]);

      await upsertMdArtifact({
        ...artifact,
        lastIndex: (new Date()).toISOString(),
      });

      await upsertSyncTask({
        integration: artifact.integration,
        status: "SUCCESS",
        inputs: JSON.stringify({ offset: curOffset }),
        step: "index-vector",
      });
    } catch (e) {
      console.error("[ERROR INDEXING]", e);
      await upsertSyncTask({
        integration: artifact.integration,
        status: "FAILED",
        inputs: JSON.stringify({ offset: curOffset }),
        step: "index-vector",
      });
    }
  }
}

interface LineChunk {
  text: string;
  startLine: number;
  endLine: number;
}

function chunkLines(lines: string[], maxWordsPerChunk: number = 250): LineChunk[] {
  const chunks: LineChunk[] = [];
  let currentLines: string[] = [];
  let currentWordCount = 0;
  let windowStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineWords = line!.trim().split(/\s+/).length;

    if (currentWordCount + lineWords > maxWordsPerChunk && currentLines.length > 0) {
      chunks.push({
        text: currentLines.join("\n"),
        startLine: windowStart,
        endLine: i - 1,
      });

      currentLines = [line!];
      currentWordCount = lineWords;
      windowStart = i;
    } else {
      currentLines.push(line!);
      currentWordCount += lineWords;
    }
  }

  if (currentLines.length > 0) {
    chunks.push({
      text: currentLines.join("\n"),
      startLine: windowStart,
      endLine: lines.length - 1,
    });
  }

  return chunks;
}
