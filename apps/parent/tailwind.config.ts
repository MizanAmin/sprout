import type { Config } from 'tailwindcss';
import nativewindPreset from 'nativewind/preset';
import { sproutPreset } from '@sprout/config/tailwind.config';

// NativeWind v4 + shared Sprout colour tokens (same palette as the staff app).
export default {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [nativewindPreset, sproutPreset],
} satisfies Config;
