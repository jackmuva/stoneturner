// Streaming RFC4180-ish CSV parser for large files.
// Handles quoted fields, embedded commas/newlines, and "" escapes.
// Emits each row via onRow as (string | null)[] — unquoted empty field -> null.
export async function streamCsv(
  path: string,
  onRow: (row: (string | null)[], rowIndex: number) => void | Promise<void>,
): Promise<void> {
  const stream = Bun.file(path).stream();
  const decoder = new TextDecoder();

  let row: (string | null)[] = [];
  let field = "";
  let inQuotes = false;
  let quoted = false; // did the current field have surrounding quotes?
  let afterQuote = false; // just closed a quote; a following char other than ," is malformed but appended
  let rowIndex = 0;

  const pushField = () => {
    row.push(!quoted && field === "" ? null : field);
    field = "";
    quoted = false;
    afterQuote = false;
  };

  const processChunk = async (text: string) => {
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]!;
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; continue; }
          inQuotes = false; afterQuote = true; continue;
        }
        field += ch; continue;
      }
      if (ch === '"') { inQuotes = true; quoted = true; afterQuote = false; continue; }
      if (ch === ",") { pushField(); continue; }
      if (ch === "\r") { continue; }
      if (ch === "\n") {
        pushField();
        await onRow(row, rowIndex++);
        row = [];
        continue;
      }
      field += ch;
    }
  };

  for await (const chunk of stream) {
    await processChunk(decoder.decode(chunk, { stream: true }));
  }
  // flush any trailing chunk + final row without newline
  await processChunk(decoder.decode());
  if (field !== "" || row.length > 0) {
    pushField();
    await onRow(row, rowIndex++);
  }
}
