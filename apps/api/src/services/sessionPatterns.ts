// child_sessions expand/count helpers — shared by the invoice generator,
// funded-hours report, and funding reconciliation.

const DAY_INDEX: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5 };

// Subset of a child_sessions row needed for range expansion.
export interface ChildSessionPattern {
  day: string;
  start_date: string;
  end_date: string | null;
  fee_hours: number | null;
  funded_hours: number | null;
}

export function countWeekdayOccurrences(start: string, end: string, day: string): number {
  const target = DAY_INDEX[day];
  if (!target || !start || !end) return 0;
  const cur = new Date(start + 'T00:00:00Z');
  const endDate = new Date(end + 'T00:00:00Z');
  let count = 0;
  while (cur <= endDate) {
    if (cur.getUTCDay() === target) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

export function expandPatternsForRange(
  patterns: ChildSessionPattern[],
  rangeStart: string,
  rangeEnd: string,
): { feeHours: number; fundedHours: number } {
  let feeHours = 0;
  let fundedHours = 0;
  for (const pat of patterns) {
    const overlapStart = pat.start_date > rangeStart ? pat.start_date : rangeStart;
    const overlapEnd = pat.end_date && pat.end_date < rangeEnd ? pat.end_date : rangeEnd;
    const n = countWeekdayOccurrences(overlapStart, overlapEnd, pat.day);
    feeHours += (pat.fee_hours ?? 0) * n;
    fundedHours += (pat.funded_hours ?? 0) * n;
  }
  return { feeHours, fundedHours };
}
