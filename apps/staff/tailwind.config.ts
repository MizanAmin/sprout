import type { Config } from 'tailwindcss';
import { sproutPreset } from '@sprout/config/tailwind.config';

// The staff app maps the shared tokens onto CSS variables so it can flip
// light/dark at runtime (see :root + .dark in src/index.css). The parent native
// app keeps the static hex values from sproutPreset (NativeWind can't resolve
// CSS vars), so this override lives here, not in the shared preset.
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  presets: [sproutPreset],
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // Scan the shared UI package so its Tailwind classes aren't purged.
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: v('--c-primary'), light: v('--c-primary-light'), dark: v('--c-primary-dark') },
        success: { DEFAULT: v('--c-success'), light: v('--c-success-light') },
        warning: { DEFAULT: v('--c-warning'), light: v('--c-warning-light') },
        danger: { DEFAULT: v('--c-danger'), light: v('--c-danger-light') },
        info: { DEFAULT: v('--c-info'), light: v('--c-info-light') },
        purple: { DEFAULT: v('--c-purple'), light: v('--c-purple-light') },
        muted: v('--c-muted'),
        border: v('--c-border'),
        surface: v('--c-surface'),
        bg: v('--c-bg'),
        sidebar: { DEFAULT: v('--c-sidebar'), hover: v('--c-sidebar-hover'), active: v('--c-sidebar-active') },
      },
    },
  },
} satisfies Config;
