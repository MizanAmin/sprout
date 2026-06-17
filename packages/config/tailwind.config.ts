import type { Config } from 'tailwindcss';

// Shared design tokens — single source of truth for both the staff web app
// (Tailwind v3) and the parent native app (NativeWind v4).
// Tokens mirror the live app (app.sproutnursery.co.uk) — indigo primary on a
// slate canvas, Inter, with semantic accents. Keep in sync with that app.
export const sproutColors = {
  primary: { DEFAULT: '#4f46e5', light: '#eef2ff', dark: '#4338ca' },
  success: { DEFAULT: '#10b981', light: '#d1fae5' },
  warning: { DEFAULT: '#f59e0b', light: '#fef3c7' },
  danger: { DEFAULT: '#ef4444', light: '#fee2e2' },
  info: { DEFAULT: '#06b6d4', light: '#cffafe' },
  purple: { DEFAULT: '#8b5cf6', light: '#ede9fe' },
  muted: '#64748b',
  border: '#e2e8f0',
  surface: '#ffffff',
  bg: '#f8fafc',
  sidebar: { DEFAULT: '#0f172a', hover: '#1e293b', active: '#312e81' },
};

// Base preset apps extend via `presets: [sproutPreset]`.
export const sproutPreset = {
  theme: {
    extend: {
      colors: sproutColors,
    },
  },
} satisfies Partial<Config>;

export default sproutPreset;
