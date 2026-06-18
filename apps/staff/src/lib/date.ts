// UK numeric date formatting: DD-MM-YYYY. Accepts an ISO/date string or a Date.
// Date-only strings ('YYYY-MM-DD') are reordered directly to avoid timezone
// shifts; full timestamps fall back to the parsed local date. Empty/invalid
// inputs render as an em dash.
export function fmtDate(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const s = typeof input === 'string' ? input : input.toISOString();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return typeof input === 'string' ? input : '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}
