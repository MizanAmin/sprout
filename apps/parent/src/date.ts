// UK numeric date: DD-MM-YYYY. Date-only strings ('YYYY-MM-DD') are reordered
// directly to avoid timezone shifts; timestamps fall back to the parsed date.
export function fmtDate(input: string | null | undefined): string {
  if (!input) return '—';
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}
