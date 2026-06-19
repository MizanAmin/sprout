import { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Modal,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import Signature, { type SignatureViewRef } from 'react-native-signature-canvas';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/api';
import { useStore } from '../../src/store';
import { Card, Pill, EmptyState, Loading } from '../../src/ui';
import { colors } from '../../src/theme';

interface ConsentForm {
  id: number;
  child_name: string;
  status: string;
  // The current parent endpoint returns the form row; template body text is
  // surfaced when available.
  title?: string;
  body?: string;
}

const statusPill = (status: string): { bg: string; fg: string } => {
  const s = status.toLowerCase();
  if (s.includes('sign') && !s.includes('un') && !s.includes('await'))
    return { bg: '#d1fae5', fg: colors.success };
  if (s.includes('pending') || s.includes('await')) return { bg: '#cffafe', fg: '#0e7490' };
  return { bg: '#fef3c7', fg: colors.warning };
};

export default function Forms() {
  const activeChildId = useStore((s) => s.activeChildId);
  const qc = useQueryClient();
  const [active, setActive] = useState<ConsentForm | null>(null);
  const sigRef = useRef<SignatureViewRef>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
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

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg">
        <Loading />
      </View>
    );
  }

  return (
    <>
      <FlatList
        className="flex-1 bg-bg"
        contentContainerClassName="p-4 gap-3"
        data={data ?? []}
        keyExtractor={(f) => String(f.id)}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View className="mt-8">
            <EmptyState
              emoji="✍️"
              title="No forms to sign"
              subtitle="Consent forms from your nursery will appear here when they need your signature."
            />
          </View>
        }
        renderItem={({ item }) => {
          const pill = statusPill(item.status);
          return (
            <Pressable onPress={() => setActive(item)}>
              <Card className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary-light">
                  <Text className="text-xl">✍️</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-gray-900">{item.title ?? 'Consent form'}</Text>
                  <Text className="mt-0.5 text-xs text-muted">{item.child_name}</Text>
                </View>
                <Pill label={item.status} bg={pill.bg} fg={pill.fg} />
              </Card>
            </Pressable>
          );
        }}
      />

      <Modal visible={!!active} animationType="slide" onRequestClose={() => setActive(null)}>
        <SafeAreaProvider>
          <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-bg">
            {/* Header with a visible Back/close control */}
            <View className="flex-row items-center justify-between border-b border-border bg-surface px-4 py-3">
              <Pressable
                onPress={() => setActive(null)}
                className="flex-row items-center gap-1 py-1 pr-2"
              >
                <Text className="text-xl text-primary">‹</Text>
                <Text className="text-base font-medium text-primary">Back</Text>
              </Pressable>
              <Text className="flex-1 text-center text-base font-semibold text-gray-900" numberOfLines={1}>
                {active?.title ?? 'Consent form'}
              </Text>
              {/* spacer to balance the Back button so the title stays centred */}
              <View className="w-12" />
            </View>

            <ScrollView className="flex-1" contentContainerClassName="p-4">
              <Card>
                <Text className="text-sm leading-6 text-gray-900">
                  {active?.body ?? 'Please review and sign below to provide your consent.'}
                </Text>
              </Card>
            </ScrollView>

            <View className="border-t border-border bg-surface" style={{ height: 300 }}>
              <Text className="px-4 pt-3 text-xs font-bold uppercase tracking-wide text-muted">
                Draw your signature below
              </Text>
              <View style={{ flex: 1 }}>
                {active && (
                  <Signature
                    ref={sigRef}
                    onOK={(sig) => sign.mutate({ id: active.id, signatureData: sig })}
                    onEmpty={() =>
                      Alert.alert(
                        'Please sign first',
                        'Draw your signature in the box, then tap Submit.',
                      )
                    }
                    descriptionText=""
                    // Hide the built-in webview footer — we use native buttons below.
                    webStyle="
                      .m-signature-pad--footer { display: none; }
                      .m-signature-pad { box-shadow: none; border: none; }
                      .m-signature-pad--body { border: none; }
                      html, body, .m-signature-pad { height: 100%; }
                    "
                  />
                )}
              </View>
              <View className="flex-row gap-3 px-4 pb-1 pt-1">
                <Pressable
                  onPress={() => sigRef.current?.clearSignature()}
                  className="flex-1 items-center rounded-xl border border-border bg-surface py-3"
                >
                  <Text className="font-semibold text-primary">Clear</Text>
                </Pressable>
                <Pressable
                  onPress={() => sigRef.current?.readSignature()}
                  disabled={sign.isPending}
                  className="flex-1 items-center rounded-xl bg-primary py-3 disabled:opacity-50"
                >
                  <Text className="font-semibold text-white">
                    {sign.isPending ? 'Submitting…' : 'Submit'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </>
  );
}
