import type { Config } from 'tailwindcss';
import { sproutPreset } from '@sprout/config/tailwind.config';

export default {
  presets: [sproutPreset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // Scan the shared UI package so its Tailwind classes aren't purged.
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
} satisfies Config;
