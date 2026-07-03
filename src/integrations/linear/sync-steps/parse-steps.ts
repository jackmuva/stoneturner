import type { SqliteDb } from "@/core/models/db-models";
import { getLinearDocuments, getLinearIssues, getLinearProjects } from "../db/queries";
import type { LinearDocumentSelect, LinearIssueSelect, LinearProjectSelect } from "../db/schema";
import { LINEAR_PRIORITY } from "../models/models";
import { parseTable, renderComments } from "./parse-utils";

const renderIssue = (row: LinearIssueSelect): string => {
  const priority = row.priority != null ? LINEAR_PRIORITY[row.priority] ?? String(row.priority) : "None";
  const labels = row.labels?.length ? `\n**Labels:** ${row.labels.join(", ")}` : "";
  const project = row.projectName ? `\n**Project:** ${row.projectName}` : "";
  const cycle = row.cycleName ? `\n**Cycle:** ${row.cycleName}` : "";
  const due = row.dueDate ? `\n**Due:** ${row.dueDate}` : "";

  return `# ${row.identifier}: ${row.title ?? ""}

**Team:** ${row.teamKey}
**State:** ${row.state ?? ""}${row.stateType ? ` (${row.stateType})` : ""}
**Priority:** ${priority}
**Assignee:** ${row.assignee ?? "unassigned"}
**Creator:** ${row.creator ?? "unknown"}
**URL:** ${row.url ?? ""}${labels}${project}${cycle}${due}

${row.description ?? ""}${renderComments(row.comments)}`;
};

export const parseLinearIssuesStep = async (db: SqliteDb, offset?: number) => {
  await parseTable(
    "linear-parse-issues",
    (o) => getLinearIssues(o, db),
    renderIssue,
    (r) => r.updatedAt ?? r.createdAt,
    db,
    offset,
  );
};

const renderProjectUpdates = (row: LinearProjectSelect): string => {
  if (!row.updates?.length) return "";
  return "\n\n## Project Updates\n\n" + row.updates.map((u) => {
    const health = u.health ? ` (${u.health})` : "";
    return `**${u.author ?? "unknown"}**${health} — ${u.createdAt ?? ""}\n\n${u.body ?? ""}`;
  }).join("\n\n---\n\n");
};

const renderProject = (row: LinearProjectSelect): string => {
  const teams = row.teamKeys?.length ? `\n**Teams:** ${row.teamKeys.join(", ")}` : "";
  const dates = [
    row.startDate ? `Start: ${row.startDate}` : null,
    row.targetDate ? `Target: ${row.targetDate}` : null,
  ].filter(Boolean).join(" · ");

  return `# Project: ${row.name ?? ""}

**State:** ${row.state ?? ""}
**Progress:** ${row.progress ?? "unknown"}%
**Lead:** ${row.lead ?? "unassigned"}${teams}
**URL:** ${row.url ?? ""}
${dates ? `\n**Dates:** ${dates}` : ""}

${row.description ?? ""}${renderProjectUpdates(row)}`;
};

export const parseLinearProjectsStep = async (db: SqliteDb, offset?: number) => {
  await parseTable(
    "linear-parse-projects",
    (o) => getLinearProjects(o, db),
    renderProject,
    (r) => r.updatedAt ?? r.createdAt,
    db,
    offset,
  );
};

const renderDocument = (row: LinearDocumentSelect): string => {
  const links = [
    row.projectName ? `**Project:** ${row.projectName}` : null,
    row.issueIdentifier ? `**Issue:** ${row.issueIdentifier}${row.issueTitle ? ` — ${row.issueTitle}` : ""}` : null,
  ].filter(Boolean).join("\n");

  return `# ${row.title ?? "Untitled document"}

**URL:** ${row.url ?? ""}
**Creator:** ${row.creator ?? "unknown"}
**Updated by:** ${row.updatedBy ?? "unknown"}
${links ? `\n${links}` : ""}

${row.content ?? ""}${renderComments(row.comments)}`;
};

export const parseLinearDocumentsStep = async (db: SqliteDb, offset?: number) => {
  await parseTable(
    "linear-parse-documents",
    (o) => getLinearDocuments(o, db),
    renderDocument,
    (r) => r.updatedAt ?? r.createdAt,
    db,
    offset,
  );
};
