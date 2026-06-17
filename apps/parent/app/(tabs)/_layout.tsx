import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/api';
import { useStore, type Child, type Nursery, type AuthUser } from '../../src/store';
import { ChildSwitcher } from '../../src/components/ChildSwitcher';

export default function TabsLayout() {
  const setChildren = useStore((s) => s.setChildren);
  const setNursery = useStore((s) => s.setNursery);
  const setUser = useStore((s) => s.setUser);

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
      <SafeAreaView edges={['top']} className="bg-surface">
        <ChildSwitcher />
      </SafeAreaView>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#4f8ef7',
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="daily" options={{ title: 'Daily' }} />
        <Tabs.Screen name="journal" options={{ title: 'Journal' }} />
        <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
        {/* Reachable via navigation (Home alerts / buttons), hidden from the tab bar */}
        <Tabs.Screen name="invoices" options={{ href: null }} />
        <Tabs.Screen name="forms" options={{ href: null }} />
        <Tabs.Screen name="bookings" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
