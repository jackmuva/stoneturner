import { getMdArtifactsByIntegration, upsertSyncTask } from "@/core/db/queries/queries";
import type { MdArtifactSelect } from "@/core/db/schema/schema";
import {
  getEmbeddingsByIntegrationArtifactId,
  upsertContentEmbedding,
  upsertKeyPointsEmbedding,
  upsertQuestionsAnsweredEmbedding,
} from "@/core/db/queries/vector-queries";
import { embedTexts } from "@/core/services/embedding";
import { PAGE_SIZE } from "@/lib/constants";
import { retry } from "@/lib/utils";
import { aiGatewayBottleneck } from "@/core/services/rate-limiter";
import type { SqliteDb } from "@/core/models/db-models";

export const indexVectorDbStep = async (integration: string, incremental: boolean = true, db: SqliteDb, offset?: number) => {
  let curOffset: number = offset ? offset : 0;
  let artifacts: MdArtifactSelect[] = [];
  let firstIteration = true;

  while (artifacts.length > 0 || firstIteration) {
    firstIteration = false;
    try {
      artifacts = await getMdArtifactsByIntegration(db, integration, curOffset, undefined);
      await Promise.allSettled(
        artifacts.map((artifact) => aiGatewayBottleneck.schedule(() => chunkMd(artifact, incremental, db)))
      );
      await upsertSyncTask({
        integration: integration,
        status: "SUCCESS",
        inputs: JSON.stringify({ offset: curOffset }),
        step: "index-vector",
      }, db);

      if (offset !== undefined) break;
    } catch (e) {
      await upsertSyncTask({
        integration: integration,
        status: "SUCCESS",
        inputs: JSON.stringify({ offset: curOffset, error: e }),
        step: "index-vector",
      }, db);
    }
    curOffset += PAGE_SIZE;
  }
}

export const chunkMd = async (artifact: MdArtifactSelect, incremental: boolean, db: SqliteDb) => {
  if (!artifact.markdown) return;

  if (!incremental) {
    const embeddings = await getEmbeddingsByIntegrationArtifactId(artifact.integrationArtifactId, db);
    if (embeddings.length > 0) return;
  }

  const lines = artifact.markdown.split("\n").filter((line) => line.trim() !== "");
  const chunks = chunkLines(lines, 250);

  if (chunks.length === 0) return;

  const keyPoints = (artifact.keyPoints || []).filter((kp) => kp.trim() !== "");
  const questionsAnswered = (artifact.questionsAnswered || []).filter((qa) => qa.trim() !== "");

  await Promise.all([
    retry(async () => {
      const embeddings = await embedTexts(chunks.map((c) => c.text));
      await Promise.all(chunks.map((c, i) => upsertContentEmbedding({
        id: `${artifact.id}-lines-${c.startLine}-${c.endLine}`,
        integrationArtifactId: artifact.integrationArtifactId,
        integration: artifact.integration,
        artifactDate: artifact.artifactDate,
        content: c.text,
        entities: artifact.entities,
        embedding: embeddings[i]!,
      }, db)));
    }),
    retry(async () => {
      if (keyPoints.length === 0) return;
      const embeddings = await embedTexts(keyPoints);
      await Promise.all(keyPoints.map((kp, i) => upsertKeyPointsEmbedding({
        id: `${artifact.id}-kp-${i}`,
        integrationArtifactId: artifact.integrationArtifactId,
        integration: artifact.integration,
        artifactDate: artifact.artifactDate,
        content: kp,
        entities: artifact.entities,
        embedding: embeddings[i]!,
      }, db)));
    }),
    retry(async () => {
      if (questionsAnswered.length === 0) return;
      const embeddings = await embedTexts(questionsAnswered);
      await Promise.all(questionsAnswered.map((qa, i) => upsertQuestionsAnsweredEmbedding({
        id: `${artifact.id}-qa-${i}`,
        integrationArtifactId: artifact.integrationArtifactId,
        integration: artifact.integration,
        artifactDate: artifact.artifactDate,
        content: qa,
        entities: artifact.entities,
        embedding: embeddings[i]!,
      }, db)));
    }),
  ]);
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
