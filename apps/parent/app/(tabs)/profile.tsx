import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@sprout/db/native';
import { api } from '../../src/api';
import { useStore } from '../../src/store';
import { ScreenScroll, Card, SectionTitle, Avatar } from '../../src/ui';
import { colors } from '../../src/theme';

export default function Profile() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const nursery = useStore((s) => s.nursery);
  const children = useStore((s) => s.children);
  const reset = useStore((s) => s.reset);

  async function signOut() {
    await supabase.auth.signOut();
    reset();
    router.replace('/(auth)/login');
  }

  const del = useMutation({
    mutationFn: () => api.delete('/parent/account'),
    onSuccess: async () => {
      await supabase.auth.signOut();
      reset();
      Alert.alert('Account deleted', 'Your account and app access have been removed.');
      router.replace('/(auth)/login');
    },
    onError: (e: { message?: string }) =>
      Alert.alert('Could not delete account', e?.message ?? 'Please try again.'),
  });

  function confirmDelete() {
    Alert.alert(
      'Delete your account?',
      "This permanently removes your parent login and access to this app. Your child's records stay with the nursery. This cannot be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: () => del.mutate() },
      ],
    );
  }

  return (
    <ScreenScroll>
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-gray-900">Profile</Text>
        <Pressable onPress={() => router.back()} className="py-1">
          <Text className="font-medium text-primary">Done</Text>
        </Pressable>
      </View>

      <Card className="flex-row items-center gap-3">
        <Avatar name={user?.name} size={56} />
        <View className="flex-1">
          <Text className="text-lg font-semibold text-gray-900">{user?.name ?? '—'}</Text>
          {!!user?.email && <Text className="text-sm text-muted">{user.email}</Text>}
          {!!nursery?.name && <Text className="mt-0.5 text-xs text-muted">{nursery.name}</Text>}
        </View>
      </Card>

      <SectionTitle>Children</SectionTitle>
      <Card>
        {children.length === 0 ? (
          <Text className="text-sm text-muted">No children linked.</Text>
        ) : (
          children.map((ch, i) => (
            <View
              key={ch.id}
              className={`flex-row items-center gap-3 ${i > 0 ? 'mt-3 border-t border-border pt-3' : ''}`}
            >
              <Avatar name={ch.name} uri={ch.photo_url} size={36} />
              <View>
                <Text className="font-medium text-gray-900">{ch.name}</Text>
                <Text className="text-xs text-muted">{ch.room || 'No room set'}</Text>
              </View>
            </View>
          ))
        )}
      </Card>

      <SectionTitle>Account</SectionTitle>
      <Pressable onPress={signOut}>
        <Card className="flex-row items-center justify-between">
          <Text className="font-semibold text-gray-900">Sign out</Text>
          <Text className="text-muted">›</Text>
        </Card>
      </Pressable>
      <Pressable onPress={confirmDelete} disabled={del.isPending}>
        <Card className="flex-row items-center justify-between">
          <Text className="font-semibold" style={{ color: colors.danger }}>
            {del.isPending ? 'Deleting…' : 'Request account deletion'}
          </Text>
          {del.isPending ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={{ color: colors.danger }}>›</Text>
          )}
        </Card>
      </Pressable>

      <Text className="px-1 pt-2 text-xs text-muted">Sprout · v1.0.0</Text>
    </ScreenScroll>
  );
}
