// One-off importer: loads syncTask.csv into the syncTask table.
// Notes:
//   - CSV trailing `userId` column is dropped.
//   - The CSV `inputs` cell is a JSON-encoded JSON string; we unwrap one level
//     so the stored value is the same JSON the app would have written, then
//     parse it to pull out the `workflow` field, which becomes `step`.
//     Rows whose inputs have no `workflow` get step = "none".
import { db } from "@/core/db/db";
import { sql } from "drizzle-orm";
import { streamCsv } from "./csv-stream";

const CSV_PATH = "syncTask.csv";
const BATCH_SIZE = 200;

// schema column -> CSV header it comes from ("step" is derived, not a column)
const COLUMN_MAP: Record<string, string> = {
  id: "id",
  integration: "integration",
  updateDate: "updateDate",
  status: "status",
  inputs: "inputs",
};
const TABLE_COLUMNS = [...Object.keys(COLUMN_MAP), "step"];
const COLS_SQL = sql.raw(TABLE_COLUMNS.join(", "));

// Returns { inputs, step } from the raw CSV `inputs` cell.
const parseInputs = (raw: string | null): { inputs: string | null; step: string } => {
  if (raw === null) return { inputs: null, step: "none" };
  let inputs = raw;
  let obj: any = null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") {
      inputs = parsed; // unwrap the double-encoding to the stored JSON
      obj = JSON.parse(parsed);
    } else {
      obj = parsed;
    }
  } catch {
    /* leave inputs as-is, no workflow extractable */
  }
  const step = typeof obj?.workflow === "string" ? obj.workflow : "none";
  return { inputs, step };
};

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
    sql`INSERT INTO syncTask (${COLS_SQL}) VALUES ${valuesSql} ON CONFLICT(id) DO NOTHING`,
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
  const { inputs, step } = parseInputs(row[headerIdx!.get("inputs")!] ?? null);
  batch.push([
    ...Object.keys(COLUMN_MAP).map((col) =>
      col === "inputs" ? inputs : row[headerIdx!.get(COLUMN_MAP[col]!)!] ?? null,
    ),
    step,
  ]);
  if (batch.length >= BATCH_SIZE) await flush();
});
await flush();

const total: any = await db.get(sql`SELECT count(*) as n FROM syncTask`);
console.log(`Read ${seen} rows; inserted ${inserted} new (skipped ${seen - inserted} dupes). Table now has ${total.n} rows.`);
