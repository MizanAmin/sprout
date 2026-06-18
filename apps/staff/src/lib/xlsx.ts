// Native .xlsx export via SheetJS. Dynamically imported so the ~400KB library
// stays out of the main bundle and only loads when the user exports.

export interface XlsxSheet {
  name: string;
  rows: Record<string, unknown>[];
}

/** Build an .xlsx workbook (one tab per sheet) and trigger a download. */
export async function exportXlsx(filename: string, sheets: XlsxSheet[]): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows);
    // Excel sheet names are max 31 chars and can't contain : \ / ? * [ ]
    const safeName = s.name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Sheet1';
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }
  XLSX.writeFile(wb, filename);
}
