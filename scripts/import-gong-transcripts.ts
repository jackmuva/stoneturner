// One-off importer: loads gongTranscript.csv into the gongTranscript table.
// The CSV carries a trailing `userId` column that the current schema drops.
// `transcript` holds a JSON string and is inserted verbatim (no re-stringify).
import { db } from "@/core/db/db";
import { sql } from "drizzle-orm";
import { streamCsv } from "./csv-stream";

const CSV_PATH = "gongTranscript.csv";
const BATCH_SIZE = 200;

const TABLE_COLUMNS = ["id", "callId", "transcript"];
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
    sql`INSERT INTO gongTranscript (${COLS_SQL}) VALUES ${valuesSql} ON CONFLICT(callId) DO NOTHING`,
  );
  inserted += res?.rowsAffected ?? res?.changes ?? 0;
  batch = [];
};

await streamCsv(CSV_PATH, async (row, rowIndex) => {
  if (rowIndex === 0) {
    headerIdx = new Map(row.map((c, j) => [c ?? "", j] as const));
    for (const col of TABLE_COLUMNS) {
      if (!headerIdx.has(col)) throw new Error(`CSV missing expected column: ${col}`);
    }
    return;
  }
  if (row.every((c) => c === null)) return;
  seen++;
  batch.push(TABLE_COLUMNS.map((col) => row[headerIdx!.get(col)!] ?? null));
  if (batch.length >= BATCH_SIZE) await flush();
});
await flush();

const total: any = await db.get(sql`SELECT count(*) as n FROM gongTranscript`);
console.log(`Read ${seen} rows; inserted ${inserted} new (skipped ${seen - inserted} dupes). Table now has ${total.n} rows.`);
