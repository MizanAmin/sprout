import type { ReactNode } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { colors, cardShadow } from './theme';

// A scrollable screen body with pull-to-refresh and consistent padding.
export function ScreenScroll({
  children,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="p-4 gap-4"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={`rounded-2xl bg-surface p-4 ${className}`} style={cardShadow}>
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text className="px-1 text-xs font-bold uppercase tracking-wide text-muted">{children}</Text>
  );
}

export function Pill({
  label,
  bg = colors.primaryLight,
  fg = colors.primary,
}: {
  label: string;
  bg?: string;
  fg?: string;
}) {
  return (
    <View className="self-start rounded-full px-2.5 py-1" style={{ backgroundColor: bg }}>
      <Text className="text-xs font-semibold" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

export function Avatar({
  name,
  uri,
  size = 56,
}: {
  name?: string | null;
  uri?: string | null;
  size?: number;
}) {
  const initial = (name ?? '?').trim()[0]?.toUpperCase() ?? '?';
  if (uri) {
    return (
      <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    );
  }
  return (
    <View
      className="items-center justify-center bg-primary-light"
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      <Text className="font-bold text-primary" style={{ fontSize: size * 0.4 }}>
        {initial}
      </Text>
    </View>
  );
}

export function EmptyState({
  emoji = '🌱',
  title,
  subtitle,
}: {
  emoji?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View className="items-center gap-1 rounded-2xl border border-dashed border-border bg-surface/60 px-6 py-10">
      <Text className="text-4xl">{emoji}</Text>
      <Text className="mt-1 text-center text-base font-semibold text-gray-900">{title}</Text>
      {!!subtitle && <Text className="text-center text-sm text-muted">{subtitle}</Text>}
    </View>
  );
}

export function Loading() {
  return (
    <View className="items-center py-10">
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

// Simple skeleton placeholder block.
export function Skeleton({ height = 80, className = '' }: { height?: number; className?: string }) {
  return <View className={`rounded-2xl bg-black/5 ${className}`} style={{ height }} />;
}
