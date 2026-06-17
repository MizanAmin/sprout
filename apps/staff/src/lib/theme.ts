// Light/dark theme: toggles the `dark` class on <html>, persisted to
// localStorage and seeded from the OS preference on first load.
const KEY = 'sprout_theme';

export function initTheme(): void {
  const saved = localStorage.getItem(KEY);
  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
}

export function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

export function toggleTheme(): boolean {
  const dark = document.documentElement.classList.toggle('dark');
  localStorage.setItem(KEY, dark ? 'dark' : 'light');
  return dark;
}
