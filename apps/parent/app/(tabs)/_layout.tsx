import { useEffect } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tabs, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/api';
import { useStore, type Child, type Nursery, type AuthUser } from '../../src/store';
import { ChildSwitcher } from '../../src/components/ChildSwitcher';
import { Avatar } from '../../src/ui';
import { colors } from '../../src/theme';

const TAB_ICON: Record<string, string> = {
  index: '🏠',
  daily: '📋',
  journal: '📖',
  messages: '💬',
};
const TAB_TITLE: Record<string, string> = {
  index: 'Home',
  daily: 'Daily',
  journal: 'Journal',
  messages: 'Messages',
};

export default function TabsLayout() {
  const setChildren = useStore((s) => s.setChildren);
  const setNursery = useStore((s) => s.setNursery);
  const setUser = useStore((s) => s.setUser);
  const nursery = useStore((s) => s.nursery);
  const child = useStore((s) => s.children.find((c) => c.id === s.activeChildId));
  const childCount = useStore((s) => s.children.length);
  const router = useRouter();

  // Load the parent context once and seed the store (children → default active
  // child; nursery + user for screens like Home).
  const { data } = useQuery({
    queryKey: ['parent', 'me'],
    queryFn: () => api.get<{ user: AuthUser; children: Child[]; nursery: Nursery }>('/parent/me'),
  });
  useEffect(() => {
    if (!data) return;
    setChildren(data.children);
    setNursery(data.nursery);
    setUser(data.user);
  }, [data, setChildren, setNursery, setUser]);

  return (
    <View className="flex-1 bg-bg">
      {/* Branded header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.primary }}>
        <View className="flex-row items-center justify-between px-4 pb-3 pt-1">
          <View>
            <View className="flex-row items-center gap-1.5">
              <Image
                source={require('../../assets/leaf-white.png')}
                style={{ width: 18, height: 18 }}
                resizeMode="contain"
              />
              <Text className="text-base font-bold text-white">Sprout</Text>
            </View>
            <Text className="text-xs text-white/70">{nursery?.name ?? 'Your nursery'}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            className="flex-row items-center gap-2"
            accessibilityLabel="Profile and settings"
          >
            {child ? (
              <>
                <Text className="text-sm font-semibold text-white">{child.name.split(' ')[0]}</Text>
                <Avatar name={child.name} uri={child.photo_url} size={32} />
              </>
            ) : (
              <Text className="text-xl text-white">⚙️</Text>
            )}
          </Pressable>
        </View>
        {childCount > 1 && <ChildSwitcher />}
      </SafeAreaView>

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.surface },
        }}
      >
        {(['index', 'daily', 'journal', 'messages'] as const).map((name) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title: TAB_TITLE[name],
              tabBarIcon: ({ focused }) => (
                <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{TAB_ICON[name]}</Text>
              ),
            }}
          />
        ))}
        <Tabs.Screen name="invoices" options={{ href: null }} />
        <Tabs.Screen name="forms" options={{ href: null }} />
        <Tabs.Screen name="bookings" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
