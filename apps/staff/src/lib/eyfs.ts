// Shared EYFS areas, mood map, and staff:child ratio helper — mirrors the live
// app so pages stay consistent. (Pages may inline equivalents; prefer these.)

export const EYFS_AREAS = [
  { name: 'Communication & Language', prime: true, icon: '💬', short: 'C&L' },
  { name: 'Physical Development', prime: true, icon: '🏃', short: 'PD' },
  { name: 'Personal, Social & Emotional', prime: true, icon: '❤️', short: 'PSED' },
  { name: 'Literacy', prime: false, icon: '📚', short: 'Lit' },
  { name: 'Mathematics', prime: false, icon: '🔢', short: 'Maths' },
  { name: 'Understanding the World', prime: false, icon: '🌍', short: 'UW' },
  { name: 'Expressive Arts', prime: false, icon: '🎨', short: 'EAD' },
] as const;

export interface MoodMeta {
  icon: string;
  label: string;
  bg: string;
  text: string;
}

export const MOOD_MAP: Record<string, MoodMeta> = {
  happy: { icon: '😄', label: 'Happy', bg: '#dcfce7', text: '#166534' },
  excited: { icon: '🤩', label: 'Excited', bg: '#fef9c3', text: '#713f12' },
  content: { icon: '😊', label: 'Content', bg: '#e0f2fe', text: '#075985' },
  tired: { icon: '😴', label: 'Tired', bg: '#ede9fe', text: '#4c1d95' },
  unsettled: { icon: '😟', label: 'Unsettled', bg: '#fef2f2', text: '#991b1b' },
  upset: { icon: '😢', label: 'Upset', bg: '#fff1f2', text: '#9f1239' },
  calm: { icon: '😌', label: 'Calm', bg: '#f0fdf4', text: '#14532d' },
};

// Statutory EYFS staff:child ratios, inferred from a room's age group.
export function ratioForAgeGroup(ageGroup: string | null | undefined): { label: string; max: number } {
  const ag = (ageGroup || '').toLowerCase();
  if (ag.includes('baby') || ag.includes('under 2') || ag.includes('0-2')) return { label: '1:3', max: 3 };
  if (ag.includes('toddler') || ag.includes('1-2') || ag.includes('2-3')) return { label: '1:5', max: 5 };
  return { label: '1:8', max: 8 };
}
