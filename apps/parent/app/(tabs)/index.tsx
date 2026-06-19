import { View, Text, Pressable, Image, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/api';
import { useStore } from '../../src/store';
import { fmtDate } from '../../src/date';
import { moodDisplay } from '../../src/humanize';
import { ScreenScroll, Card, SectionTitle, Pill, Avatar, EmptyState } from '../../src/ui';
import { colors } from '../../src/theme';

interface ReportCard {
  attendance: { status: string } | null;
  mood: string | null;
  mealsCount: number;
  napsCount: number;
  nappiesCount: number;
}
interface NurseryEvent {
  id: number;
  title: string;
  description: string;
  date: string;
}
interface Invoice {
  id: number;
  status: string;
}
interface ConsentForm {
  id: number;
}
interface Observation {
  id: number;
  photo_url: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Home() {
  const router = useRouter();
  const activeChildId = useStore((s) => s.activeChildId);
  const child = useStore((s) => s.children.find((c) => c.id === s.activeChildId));

  const report = useQuery({
    queryKey: ['report-card', activeChildId, todayISO()],
    queryFn: () =>
      api.get<ReportCard>(`/parent/report-card?childId=${activeChildId}&date=${todayISO()}`),
    enabled: !!activeChildId,
  });
  const newsfeed = useQuery({
    queryKey: ['newsfeed'],
    queryFn: () => api.get<NurseryEvent[]>('/parent/newsfeed'),
  });
  const invoices = useQuery({
    queryKey: ['invoices', activeChildId],
    queryFn: () => api.get<Invoice[]>('/parent/invoices'),
    enabled: !!activeChildId,
  });
  const forms = useQuery({
    queryKey: ['consent-forms', activeChildId],
    queryFn: () => api.get<ConsentForm[]>(`/parent/consent-forms?childId=${activeChildId}`),
    enabled: !!activeChildId,
  });
  const photos = useQuery({
    queryKey: ['observations', activeChildId],
    queryFn: () => api.get<Observation[]>(`/parent/observations?childId=${activeChildId}`),
    enabled: !!activeChildId,
  });

  const outstanding = (invoices.data ?? []).filter(
    (i) => i.status !== 'Paid' && i.status !== 'Cancelled',
  ).length;
  const pendingForms = forms.data?.length ?? 0;
  const latestEvent = newsfeed.data?.[0];
  const mood = moodDisplay(report.data?.mood);
  const photoStrip = (photos.data ?? []).filter((o) => o.photo_url).slice(0, 8);

  const onRefresh = () => {
    report.refetch();
    newsfeed.refetch();
    invoices.refetch();
    forms.refetch();
    photos.refetch();
  };
  const refreshing =
    report.isFetching || newsfeed.isFetching || invoices.isFetching || photos.isFetching;

  const TILES = [
    { emoji: mood?.emoji ?? '🙂', label: mood?.label ?? 'Mood', bg: mood?.bg ?? '#e0f2fe', fg: mood?.fg ?? '#075985' },
    { emoji: '🍽️', label: `${report.data?.mealsCount ?? 0} meals`, bg: '#dcfce7', fg: '#166534' },
    { emoji: '😴', label: `${report.data?.napsCount ?? 0} naps`, bg: '#ede9fe', fg: '#4c1d95' },
    { emoji: '🧷', label: `${report.data?.nappiesCount ?? 0} nappies`, bg: '#fef3c7', fg: '#92400e' },
  ];

  const QUICK = [
    { emoji: '📅', label: 'Bookings', to: '/(tabs)/bookings' as const },
    { emoji: '💷', label: 'Invoices', to: '/(tabs)/invoices' as const },
    { emoji: '✍️', label: 'Forms', to: '/(tabs)/forms' as const },
    { emoji: '📖', label: 'Journal', to: '/(tabs)/journal' as const },
  ];

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={onRefresh}>
      {/* Child summary */}
      <Card className="flex-row items-center gap-3">
        <Avatar name={child?.name} uri={child?.photo_url} size={56} />
        <View className="flex-1">
          <Text className="text-lg font-semibold text-gray-900">{child?.name ?? '—'}</Text>
          <Text className="text-sm text-muted">{child?.room || 'No room set'}</Text>
        </View>
        {report.data?.attendance ? (
          <Pill label={report.data.attendance.status} bg="#d1fae5" fg={colors.success} />
        ) : (
          <Pill label="Not in yet" bg="#f1f5f9" fg={colors.muted} />
        )}
      </Card>

      {/* Today at a glance */}
      <View className="gap-2">
        <SectionTitle>Today at a glance</SectionTitle>
        <View className="flex-row gap-2">
          {TILES.map((t, i) => (
            <View
              key={i}
              className="flex-1 items-center rounded-2xl py-3"
              style={{ backgroundColor: t.bg }}
            >
              <Text className="text-2xl">{t.emoji}</Text>
              <Text className="mt-1 text-center text-[11px] font-semibold" style={{ color: t.fg }}>
                {t.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Alerts */}
      {outstanding > 0 && (
        <Pressable onPress={() => router.push('/(tabs)/invoices')}>
          <Card className="flex-row items-center gap-3 border border-warning/30">
            <Text className="text-2xl">💷</Text>
            <Text className="flex-1 font-semibold text-gray-900">
              {outstanding} outstanding invoice{outstanding > 1 ? 's' : ''}
            </Text>
            <Text className="text-muted">›</Text>
          </Card>
        </Pressable>
      )}
      {pendingForms > 0 && (
        <Pressable onPress={() => router.push('/(tabs)/forms')}>
          <Card className="flex-row items-center gap-3 border border-info/30">
            <Text className="text-2xl">✍️</Text>
            <Text className="flex-1 font-semibold text-gray-900">
              {pendingForms} consent form{pendingForms > 1 ? 's' : ''} to sign
            </Text>
            <Text className="text-muted">›</Text>
          </Card>
        </Pressable>
      )}

      {/* Recent photos */}
      {photoStrip.length > 0 && (
        <View className="gap-2">
          <SectionTitle>Recent photos</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {photoStrip.map((o) => (
              <Pressable key={o.id} onPress={() => router.push('/(tabs)/journal')}>
                <Image source={{ uri: o.photo_url }} className="h-24 w-24 rounded-2xl" />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Latest announcement */}
      <View className="gap-2">
        <SectionTitle>From your nursery</SectionTitle>
        <Card>
          {latestEvent ? (
            <Pressable onPress={() => router.push('/(tabs)/journal')}>
              <Text className="font-semibold text-gray-900">{latestEvent.title}</Text>
              {!!latestEvent.description && (
                <Text className="mt-1 text-sm text-muted">{latestEvent.description}</Text>
              )}
              <Text className="mt-2 text-xs text-muted">{fmtDate(latestEvent.date)}</Text>
            </Pressable>
          ) : (
            <Text className="text-sm text-muted">No recent announcements.</Text>
          )}
        </Card>
      </View>

      {/* Quick actions */}
      <View className="flex-row flex-wrap gap-2">
        {QUICK.map((q) => (
          <Pressable
            key={q.label}
            onPress={() => router.push(q.to)}
            className="flex-1 basis-[47%] items-center rounded-2xl bg-surface py-4"
            style={{ minWidth: 0 }}
          >
            <Text className="text-2xl">{q.emoji}</Text>
            <Text className="mt-1 text-sm font-semibold text-primary">{q.label}</Text>
          </Pressable>
        ))}
      </View>

      {!activeChildId && (
        <EmptyState title="No child linked" subtitle="Ask your nursery to link your account." />
      )}
    </ScreenScroll>
  );
}
