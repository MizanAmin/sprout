import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { useStore } from '../../src/store';
import { api } from '../../src/api';
import { useMessages, useSendMessage, useMarkRead, type Message } from '../../src/features/messages/useMessages';

export default function MessagesScreen() {
  const activeChildId = useStore((s) => s.activeChildId);
  const { data, isLoading } = useMessages(activeChildId);
  const send = useSendMessage(activeChildId);
  const markRead = useMarkRead(activeChildId);
  const [draft, setDraft] = useState('');

  // Request push permission on first open of this tab — only here, where the
  // value is clear (see Push notifications — permission timing in the spec).
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus === 'granted') {
          const token = (await Notifications.getExpoPushTokenAsync()).data;
          await api.post('/parent/push-token', { expoPushToken: token, platform: Platform.OS });
        }
      }
    })();
  }, []);

  // Mark staff messages read when the thread is opened / new ones arrive —
  // only when there's actually an unread staff message to clear.
  const hasUnreadStaff = (data ?? []).some((m) => m.from_role === 'staff' && !m.is_read);
  useEffect(() => {
    if (activeChildId && hasUnreadStaff) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChildId, hasUnreadStaff]);

  const onSend = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    send.mutate(body);
  };

  // Newest first for an inverted list.
  const messages = [...(data ?? [])].reverse();

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {isLoading ? (
        <ActivityIndicator className="mt-8" />
      ) : (
        <FlatList
          className="flex-1"
          contentContainerClassName="p-4 gap-2"
          inverted
          data={messages}
          keyExtractor={(m) => String(m.id)}
          ListEmptyComponent={
            <Text className="mt-8 text-center text-muted">No messages yet — say hello!</Text>
          }
          renderItem={({ item }: { item: Message }) => {
            const mine = item.from_role === 'parent';
            return (
              <View className={`max-w-[80%] ${mine ? 'self-end' : 'self-start'}`}>
                <View
                  className={`rounded-2xl px-3 py-2 ${mine ? 'bg-success' : 'bg-gray-100'}`}
                >
                  <Text className={mine ? 'text-white' : 'text-gray-900'}>{item.body}</Text>
                </View>
                <Text className={`mt-0.5 text-[10px] text-muted ${mine ? 'text-right' : ''}`}>
                  {!mine && item.from_name ? `${item.from_name} · ` : ''}
                  {new Date(item.created_at).toLocaleString('en-GB')}
                </Text>
              </View>
            );
          }}
        />
      )}

      <View className="flex-row items-end gap-2 border-t border-border bg-surface p-3">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message the team…"
          multiline
          className="max-h-24 flex-1 rounded-2xl border border-border bg-bg px-3 py-2 text-gray-900"
        />
        <Pressable
          onPress={onSend}
          disabled={!draft.trim() || send.isPending}
          className="rounded-full bg-primary px-4 py-2 disabled:opacity-50"
        >
          <Text className="font-medium text-white">Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
