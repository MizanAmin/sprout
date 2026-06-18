// Client-side CSV export helper.
// Builds CSV text from already-loaded data and triggers a browser download
// via a Blob + a temporary <a download>. No backend involved.

export type CsvColumn = { key: string; label: string };

// Quote a single cell only when needed (contains comma, quote, or newline),
// doubling any embedded quotes per RFC 4180.
function escapeCell(value: unknown): string {
  const str =
    value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Build CSV text (header row + one row per record). */
export function buildCsv(
  rows: Record<string, unknown>[],
  columns: CsvColumn[],
): string {
  const header = columns.map((c) => escapeCell(c.label)).join(',');
  const body = rows.map((row) =>
    columns.map((c) => escapeCell(row[c.key])).join(','),
  );
  return [header, ...body].join('\r\n');
}

// Parse CSV text into an array of objects keyed by the header row. Handles
// quoted fields (commas, newlines, doubled quotes) per RFC 4180, CRLF/LF, and a
// leading UTF-8 BOM. Header keys are trimmed; empty trailing lines are skipped.
export function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (nonEmpty.length === 0) return [];
  const headers = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? '').trim();
    });
    return obj;
  });
}

/** Build a CSV from `rows`/`columns` and trigger a download named `filename`. */
export function exportCsv(
  filename: string,
  rows: Record<string, unknown>[],
  columns: CsvColumn[],
): void {
  const csv = buildCsv(rows, columns);
  // Prepend a UTF-8 BOM so Excel reads non-ASCII characters correctly.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
