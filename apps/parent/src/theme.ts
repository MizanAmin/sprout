// JS colour constants for props that can't take NativeWind classes
// (RefreshControl tint, tab bar colours, ActivityIndicator). Mirrors the shared
// Sprout tokens (sproutColors).
export const colors = {
  primary: '#4f46e5',
  primaryDark: '#4338ca',
  primaryLight: '#eef2ff',
  bg: '#f8fafc',
  surface: '#ffffff',
  muted: '#64748b',
  border: '#e2e8f0',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  ink: '#0f172a',
};

// Soft, layered shadow shared by cards (iOS shadow + Android elevation).
export const cardShadow = {
  shadowColor: colors.ink,
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;
