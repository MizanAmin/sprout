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
