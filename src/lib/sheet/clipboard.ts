/**
 * Clipboard interchange for the Board sheet.
 *
 * Spreadsheets exchange ranges as TSV: tabs separate columns, newlines separate
 * rows. A cell containing a tab, newline, or quote is wrapped in double quotes,
 * and inner quotes are doubled — the same escaping CSV uses.
 */

const TAB = '\t';
const LF = '\n';
const QUOTE = '"';

/** Cells needing quotes when serialized. */
const NEEDS_QUOTING = /[\t\n\r"]/u;

/**
 * Parses clipboard text pasted from a spreadsheet into a rectangular grid.
 *
 * Rows are padded to the widest row so callers can index without bounds checks.
 * An empty or whitespace-only payload yields an empty grid rather than a row of
 * blanks, so pasting nothing never creates a phantom row.
 *
 * @param text - Raw `text/plain` clipboard payload.
 * @returns Rows of cell values, every row the same length.
 */
export function parseClipboardTsv(text: string): string[][] {
  if (text.trim() === '') {
    return [];
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let index = 0;

  const pushCell = () => {
    row.push(cell);
    cell = '';
  };

  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
  };

  while (index < text.length) {
    const char = text[index];

    if (char === undefined) {
      break;
    }

    if (inQuotes) {
      if (char === QUOTE) {
        // A doubled quote is a literal quote; a lone quote closes the field.
        if (text[index + 1] === QUOTE) {
          cell += QUOTE;
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      cell += char;
      index += 1;
      continue;
    }

    if (char === QUOTE && cell === '') {
      inQuotes = true;
      index += 1;
      continue;
    }

    if (char === TAB) {
      pushCell();
      index += 1;
      continue;
    }

    if (char === LF || char === '\r') {
      pushRow();
      // Treat CRLF as one break.
      index += char === '\r' && text[index + 1] === LF ? 2 : 1;
      continue;
    }

    cell += char;
    index += 1;
  }

  // Trailing newline already flushed the last row.
  if (cell !== '' || row.length > 0) {
    pushRow();
  }

  let width = 0;
  for (const current of rows) {
    width = Math.max(width, current.length);
  }

  return rows.map((current) => [
    ...current,
    ...Array.from({ length: width - current.length }, () => ''),
  ]);
}

function escapeCell(value: string): string {
  if (!NEEDS_QUOTING.test(value)) {
    return value;
  }

  return `${QUOTE}${value.replaceAll(QUOTE, QUOTE + QUOTE)}${QUOTE}`;
}

/**
 * Serializes a grid back to TSV for the clipboard.
 *
 * @param rows - Rows of cell values.
 * @returns TSV text, rows joined with newlines.
 */
export function serializeToTsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(escapeCell).join(TAB)).join(LF);
}
