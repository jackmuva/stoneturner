// One-off importer: loads mdArtifacts.csv into the mdArtifacts table.
// Schema differences from the CSV:
//   - CSV `integrationObjectId` maps to schema `integrationArtifactId`
//   - CSV trailing `userId` column is dropped
// keyPoints/questionsAnswered/entities hold JSON strings, inserted verbatim.
import { db } from "@/core/db/db";
import { sql } from "drizzle-orm";
import { streamCsv } from "./csv-stream";

const CSV_PATH = "mdArtifacts.csv";
const BATCH_SIZE = 200;

// schema column -> CSV header it comes from
const COLUMN_MAP: Record<string, string> = {
  id: "id",
  integrationArtifactId: "integrationObjectId",
  integration: "integration",
  updateDate: "updateDate",
  artifactDate: "artifactDate",
  markdown: "markdown",
  keyPoints: "keyPoints",
  questionsAnswered: "questionsAnswered",
  entities: "entities",
  lastIndex: "lastIndex",
};
const TABLE_COLUMNS = Object.keys(COLUMN_MAP);
const COLS_SQL = sql.raw(TABLE_COLUMNS.join(", "));

let headerIdx: Map<string, number> | null = null;
let batch: (string | null)[][] = [];
let inserted = 0;
let seen = 0;

const flush = async () => {
  if (batch.length === 0) return;
  const valuesSql = sql.join(
    batch.map((row) => sql`(${sql.join(row.map((v) => sql`${v}`), sql`, `)})`),
    sql`, `,
  );
  const res: any = await db.run(
    sql`INSERT INTO mdArtifacts (${COLS_SQL}) VALUES ${valuesSql} ON CONFLICT(integrationArtifactId) DO NOTHING`,
  );
  inserted += res?.rowsAffected ?? res?.changes ?? 0;
  batch = [];
};

await streamCsv(CSV_PATH, async (row, rowIndex) => {
  if (rowIndex === 0) {
    headerIdx = new Map(row.map((c, j) => [c ?? "", j] as const));
    for (const csvCol of Object.values(COLUMN_MAP)) {
      if (!headerIdx.has(csvCol)) throw new Error(`CSV missing expected column: ${csvCol}`);
    }
    return;
  }
  if (row.every((c) => c === null)) return;
  seen++;
  batch.push(TABLE_COLUMNS.map((col) => row[headerIdx!.get(COLUMN_MAP[col]!)!] ?? null));
  if (batch.length >= BATCH_SIZE) await flush();
});
await flush();

const total: any = await db.get(sql`SELECT count(*) as n FROM mdArtifacts`);
console.log(`Read ${seen} rows; inserted ${inserted} new (skipped ${seen - inserted} dupes). Table now has ${total.n} rows.`);
