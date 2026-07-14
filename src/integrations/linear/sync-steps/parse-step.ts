import { getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { PAGE_SIZE, SUMMARIZATION_MODEL } from "@/lib/constants";
import { generateText, Output } from "ai";
import * as z from "zod";
import { aiGatewayBottleneck } from "@/core/services/rate-limiter";
import type { SqliteDb } from "@/core/models/db-models";
import { getLinearIssues, getLinearProjects } from "../db/queries";
import type { LinearIssueSelect, LinearProjectSelect } from "../db/schema";
import type { StoredLinearComment } from "../models/models";
import type { LinearParseCursor, LinearParseInputs } from "./linear-utils";

const parseCursorFromInputs = (inputs?: LinearParseInputs): LinearParseCursor | undefined => {
  if (!inputs) return undefined;
  if ("cursor" in inputs && inputs.cursor) return inputs.cursor;
  if ("type" in inputs) return { type: inputs.type, offset: 0 };
  return undefined;
};

const renderComments = (comments: StoredLinearComment[] | null): string => {
  if (!comments || comments.length === 0) return "";
  return "\n\n## Comments\n\n" + comments
    .map((c) => `**${c.author ?? "unknown"}** (${c.createdAt}):\n\n${c.body}`)
    .join("\n\n---\n\n");
};

const renderIssue = (row: LinearIssueSelect): string => {
  const labels = row.labels?.length ? `\n**Labels:** ${row.labels.join(", ")}` : "";
  const project = row.projectName ? `\n**Project:** ${row.projectName}` : "";
  const assignee = row.assignee ? `\n**Assignee:** ${row.assignee}` : "";
  const priority = row.priority != null ? `\n**Priority:** ${row.priority}` : "";
  const estimate = row.estimate != null ? `\n**Estimate:** ${row.estimate}` : "";

  return `# ${row.identifier}: ${row.title ?? ""}

**Team:** ${row.teamName ?? row.teamKey ?? "unknown"}
**State:** ${row.stateName ?? ""} (${row.stateType ?? ""})${assignee}${project}${labels}${priority}${estimate}
**URL:** ${row.url ?? ""}

${row.description ?? ""}${renderComments(row.comments)}`;
};

const renderProject = (row: LinearProjectSelect): string => {
  const teams = row.teamNames?.length ? `\n**Teams:** ${row.teamNames.join(", ")}` : "";
  const lead = row.lead ? `\n**Lead:** ${row.lead}` : "";
  const dates = [
    row.startDate ? `Start: ${row.startDate}` : null,
    row.targetDate ? `Target: ${row.targetDate}` : null,
  ].filter(Boolean).join(" | ");

  return `# Project: ${row.name ?? ""}

**State:** ${row.state ?? ""}
**Progress:** ${row.progress != null ? `${Math.round(row.progress * 100)}%` : "unknown"}${teams}${lead}
${dates ? `**Dates:** ${dates}\n` : ""}
**URL:** ${row.url ?? ""}

${row.description ?? ""}`;
};

export const parseLinearStep = async (
  _incremental: boolean,
  db: SqliteDb,
  inputs?: LinearParseInputs,
  syncTaskId?: string,
): Promise<void> => {
  const cursor = parseCursorFromInputs(inputs);
  if (!cursor || cursor.type === "issue") {
    await parseIssues(db, cursor?.type === "issue" ? cursor.offset : undefined, syncTaskId);
  }
  if (!cursor || cursor.type === "project") {
    await parseProjects(db, cursor?.type === "project" ? cursor.offset : undefined, syncTaskId);
  }
};

const parseIssues = async (db: SqliteDb, cursor?: number, syncTaskId?: string): Promise<void> => {
  let curOffset = cursor ?? 0;
  let rows: LinearIssueSelect[] = [];
  let firstIteration = true;

  while (rows.length > 0 || firstIteration) {
    firstIteration = false;
    try {
      rows = await getLinearIssues(curOffset, db);
      const results = await Promise.allSettled(
        rows.map((row) => aiGatewayBottleneck.schedule(() => generateIssueArtifact(row, db))),
      );
      const failures = results
        .filter((r) => r.status === "rejected")
        .map((r) => String((r as PromiseRejectedResult).reason));

      const nextCursor = curOffset + PAGE_SIZE;
      const hasMore = rows.length >= PAGE_SIZE;
      await upsertSyncTask({
        id: syncTaskId,
        integration: "linear",
        status: failures.length ? "FAILED" : "SUCCESS",
        inputs: failures.length
          ? { cursor: { type: "issue", offset: curOffset } }
          : hasMore
            ? { cursor: { type: "issue", offset: nextCursor } }
            : { type: "issue" },
        error: failures.length ? JSON.stringify(failures) : null,
        step: "parse",
      }, db);
    } catch (e) {
      await upsertSyncTask({
        id: syncTaskId,
        integration: "linear",
        status: "FAILED",
        inputs: { cursor: { type: "issue", offset: curOffset } },
        error: String(e),
        step: "parse",
      }, db);
    }

    if (cursor !== undefined) break;
    curOffset += PAGE_SIZE;
  }
};

const parseProjects = async (db: SqliteDb, cursor?: number, syncTaskId?: string): Promise<void> => {
  let curOffset = cursor ?? 0;
  let rows: LinearProjectSelect[] = [];
  let firstIteration = true;

  while (rows.length > 0 || firstIteration) {
    firstIteration = false;
    try {
      rows = await getLinearProjects(curOffset, db);
      const results = await Promise.allSettled(
        rows.map((row) => aiGatewayBottleneck.schedule(() => generateProjectArtifact(row, db))),
      );
      const failures = results
        .filter((r) => r.status === "rejected")
        .map((r) => String((r as PromiseRejectedResult).reason));

      const nextCursor = curOffset + PAGE_SIZE;
      const hasMore = rows.length >= PAGE_SIZE;
      await upsertSyncTask({
        id: syncTaskId,
        integration: "linear",
        status: failures.length ? "FAILED" : "SUCCESS",
        inputs: failures.length
          ? { cursor: { type: "project", offset: curOffset } }
          : hasMore
            ? { cursor: { type: "project", offset: nextCursor } }
            : { type: "project" },
        error: failures.length ? JSON.stringify(failures) : null,
        step: "parse",
      }, db);
    } catch (e) {
      await upsertSyncTask({
        id: syncTaskId,
        integration: "linear",
        status: "FAILED",
        inputs: { cursor: { type: "project", offset: curOffset } },
        error: String(e),
        step: "parse",
      }, db);
    }

    if (cursor !== undefined) break;
    curOffset += PAGE_SIZE;
  }
};

const generateIssueArtifact = async (row: LinearIssueSelect, db: SqliteDb): Promise<void> => {
  const markdown = renderIssue(row);
  const existing = await getMdArtifactByIntegrationArtifactId(row.artifactId, db);
  if (existing && existing.markdown === markdown) return;

  const { output: analysis } = await retry(async () => await generateText({
    model: SUMMARIZATION_MODEL,
    prompt: `Analyze the following Linear issue and extract:
1. KEY POINTS: Main decisions, blockers, status updates, and technical details.
2. QUESTIONS ANSWERED: What problems or questions does this issue address?
3. ENTITIES: People, teams, projects, labels, and other notable names.

Issue:
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
    integrationArtifactId: row.artifactId,
    integration: "linear",
    artifactDate: row.updatedAt ?? row.createdAt ?? undefined,
    markdown,
    keyPoints: analysis.keyPoints,
    questionsAnswered: analysis.questionsAnswered,
    entities: analysis.entities,
  }, db);
};

const generateProjectArtifact = async (row: LinearProjectSelect, db: SqliteDb): Promise<void> => {
  const markdown = renderProject(row);
  const existing = await getMdArtifactByIntegrationArtifactId(row.artifactId, db);
  if (existing && existing.markdown === markdown) return;

  const { output: analysis } = await retry(async () => await generateText({
    model: SUMMARIZATION_MODEL,
    prompt: `Analyze the following Linear project and extract:
1. KEY POINTS: Goals, scope, status, and notable milestones.
2. QUESTIONS ANSWERED: What initiatives or outcomes does this project cover?
3. ENTITIES: People, teams, and other notable names.

Project:
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
    integrationArtifactId: row.artifactId,
    integration: "linear",
    artifactDate: row.updatedAt ?? row.createdAt ?? undefined,
    markdown,
    keyPoints: analysis.keyPoints,
    questionsAnswered: analysis.questionsAnswered,
    entities: analysis.entities,
  }, db);
};
