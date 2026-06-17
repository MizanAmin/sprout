import type { Config } from 'tailwindcss';

// Shared design tokens — single source of truth for both the staff web app
// (Tailwind v3) and the parent native app (NativeWind v4).
export const sproutColors = {
  primary: { DEFAULT: '#4f8ef7', light: '#e8f0fe' },
  success: { DEFAULT: '#28c76f', light: '#e8f8f0' },
  warning: { DEFAULT: '#ff9f43', light: '#fff5e8' },
  danger: { DEFAULT: '#ea5455', light: '#fde8e8' },
  info: { DEFAULT: '#00cfe8', light: '#e0f9fc' },
  muted: '#8a8fa3',
  border: '#e8eaf0',
  surface: '#ffffff',
  bg: '#f4f6fb',
  sidebar: '#1a1d27',
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
