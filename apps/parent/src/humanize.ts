// Turns raw stored values (mood text, daily-log type) into friendly display data.

export interface Display {
  emoji: string;
  label: string;
  bg: string; // soft background
  fg: string; // text/accent colour
}

const MOODS: Record<string, Display> = {
  happy: { emoji: '😄', label: 'Happy', bg: '#dcfce7', fg: '#166534' },
  excited: { emoji: '🤩', label: 'Excited', bg: '#fef9c3', fg: '#713f12' },
  content: { emoji: '😊', label: 'Content', bg: '#e0f2fe', fg: '#075985' },
  calm: { emoji: '😌', label: 'Calm', bg: '#f0fdf4', fg: '#14532d' },
  tired: { emoji: '😴', label: 'Tired', bg: '#ede9fe', fg: '#4c1d95' },
  unsettled: { emoji: '😟', label: 'Unsettled', bg: '#fef2f2', fg: '#991b1b' },
  upset: { emoji: '😢', label: 'Upset', bg: '#fff1f2', fg: '#9f1239' },
};

export function moodDisplay(raw: string | null | undefined): Display | null {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();
  return MOODS[key] ?? { emoji: '🙂', label: raw, bg: '#e0f2fe', fg: '#075985' };
}

export type LogType = 'meal' | 'sleep' | 'nappy' | 'mood' | 'activity' | 'note';

export const LOG_DISPLAY: Record<LogType, Display> = {
  meal: { emoji: '🍽️', label: 'Meal', bg: '#dcfce7', fg: '#166534' },
  sleep: { emoji: '😴', label: 'Nap', bg: '#ede9fe', fg: '#4c1d95' },
  nappy: { emoji: '🧷', label: 'Nappy', bg: '#fef3c7', fg: '#92400e' },
  mood: { emoji: '😊', label: 'Mood', bg: '#e0f2fe', fg: '#075985' },
  activity: { emoji: '🎨', label: 'Activity', bg: '#e0e7ff', fg: '#3730a3' },
  note: { emoji: '📝', label: 'Note', bg: '#f1f5f9', fg: '#475569' },
};

export function logDisplay(type: string): Display {
  return LOG_DISPLAY[(type as LogType)] ?? LOG_DISPLAY.note;
}
