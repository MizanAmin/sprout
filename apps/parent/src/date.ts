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

// 'Today' / 'Yesterday' for recent date-only values, else DD-MM-YYYY.
export function relativeDate(input: string | null | undefined): string {
  if (!input) return '—';
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  const yKey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  const key = m ? `${m[1]}-${m[2]}-${m[3]}` : input.slice(0, 10);
  if (key === todayKey) return 'Today';
  if (key === yKey) return 'Yesterday';
  return fmtDate(input);
}
