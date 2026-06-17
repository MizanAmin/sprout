import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Signature from 'react-native-signature-canvas';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/api';
import { useStore } from '../../src/store';

interface ConsentForm {
  id: number;
  child_name: string;
  status: string;
  // The current parent endpoint returns the form row; template body text is
  // surfaced when available.
  title?: string;
  body?: string;
}

export default function Forms() {
  const activeChildId = useStore((s) => s.activeChildId);
  const qc = useQueryClient();
  const [active, setActive] = useState<ConsentForm | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['consent-forms', activeChildId],
    queryFn: () => api.get<ConsentForm[]>(`/parent/consent-forms?childId=${activeChildId}`),
    enabled: !!activeChildId,
  });

  // Signer name from /parent/me.
  const me = useQuery({
    queryKey: ['parent', 'me'],
    queryFn: () => api.get<{ user: { name: string } }>('/parent/me'),
  });

  const sign = useMutation({
    mutationFn: (vars: { id: number; signatureData: string }) =>
      api.patch(`/parent/consent-forms/${vars.id}`, {
        signatureData: vars.signatureData,
        signedBy: me.data?.user.name ?? 'Parent',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consent-forms', activeChildId] });
      setActive(null);
      Alert.alert('Signed', 'Thank you — your consent has been recorded.');
    },
    onError: (e: any) => Alert.alert('Could not submit', e?.message ?? 'Try again.'),
  });

  if (isLoading) return <ActivityIndicator className="mt-8" />;

  return (
    <>
      <FlatList
        className="flex-1 bg-bg"
        contentContainerClassName="p-4 gap-3"
        data={data ?? []}
        keyExtractor={(f) => String(f.id)}
        ListEmptyComponent={
          <View className="rounded-2xl border border-dashed border-border p-8">
            <Text className="text-center text-muted">No forms need your signature.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => setActive(item)} className="rounded-2xl bg-surface p-4">
            <Text className="font-semibold text-gray-900">{item.title ?? 'Consent form'}</Text>
            <Text className="mt-1 text-xs text-muted">{item.child_name} · {item.status}</Text>
          </Pressable>
        )}
      />

      <Modal visible={!!active} animationType="slide" onRequestClose={() => setActive(null)}>
        <View className="flex-1 bg-bg">
          <View className="flex-row items-center justify-between border-b border-border bg-surface px-4 py-3">
            <Text className="text-base font-semibold text-gray-900">
              {active?.title ?? 'Consent form'}
            </Text>
            <Pressable onPress={() => setActive(null)}>
              <Text className="text-muted">✕</Text>
            </Pressable>
          </View>

          <ScrollView className="flex-1" contentContainerClassName="p-4">
            <Text className="text-sm text-gray-700">
              {active?.body ?? 'Please review and sign below to provide your consent.'}
            </Text>
          </ScrollView>

          <View className="h-64 border-t border-border">
            <Text className="px-4 pt-2 text-xs text-muted">Sign below</Text>
            {active && (
              <Signature
                onOK={(sig) => sign.mutate({ id: active.id, signatureData: sig })}
                descriptionText=""
                clearText="Clear"
                confirmText="Submit"
                webStyle=".m-signature-pad--footer { margin: 0; }"
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
