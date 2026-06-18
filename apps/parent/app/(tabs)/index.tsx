import { ScrollView, View, Text, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/api';
import { useStore } from '../../src/store';
import { fmtDate } from '../../src/date';

interface ReportCard {
  attendance: { status: string } | null;
  mood: string | null;
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

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Home() {
  const router = useRouter();
  const activeChildId = useStore((s) => s.activeChildId);
  const child = useStore((s) => s.children.find((c) => c.id === s.activeChildId));
  const nursery = useStore((s) => s.nursery);

  const report = useQuery({
    queryKey: ['report-card', activeChildId, todayISO()],
    queryFn: () => api.get<ReportCard>(`/parent/report-card?childId=${activeChildId}&date=${todayISO()}`),
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

  const outstanding = (invoices.data ?? []).filter(
    (i) => i.status !== 'Paid' && i.status !== 'Cancelled',
  ).length;
  const pendingForms = forms.data?.length ?? 0;
  const latestEvent = newsfeed.data?.[0];

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="p-4 gap-4">
      {/* Child summary */}
      <View className="flex-row items-center gap-3 rounded-2xl bg-surface p-4">
        {child?.photo_url ? (
          <Image source={{ uri: child.photo_url }} className="h-14 w-14 rounded-full" />
        ) : (
          <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-light">
            <Text className="text-lg font-semibold text-primary">
              {child?.name?.[0] ?? '?'}
            </Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="text-lg font-semibold text-gray-900">{child?.name ?? '—'}</Text>
          <Text className="text-sm text-muted">{child?.room || 'No room'}</Text>
        </View>
        {report.data?.attendance && (
          <View className="rounded-full bg-success-light px-3 py-1">
            <Text className="text-xs font-medium capitalize text-success">
              {report.data.attendance.status}
            </Text>
          </View>
        )}
      </View>

      {/* Mood */}
      <View className="rounded-2xl bg-surface p-4">
        <Text className="text-sm text-muted">Today's mood</Text>
        <Text className="mt-1 text-2xl">{report.data?.mood ?? '—'}</Text>
      </View>

      {/* Alert banners */}
      {outstanding > 0 && (
        <Pressable
          onPress={() => router.push('/(tabs)/invoices')}
          className="rounded-2xl bg-warning-light p-4"
        >
          <Text className="font-medium text-warning">
            {outstanding} outstanding invoice{outstanding > 1 ? 's' : ''} — tap to view
          </Text>
        </Pressable>
      )}
      {pendingForms > 0 && (
        <Pressable
          onPress={() => router.push('/(tabs)/forms')}
          className="rounded-2xl bg-info-light p-4"
        >
          <Text className="font-medium text-info">
            {pendingForms} consent form{pendingForms > 1 ? 's' : ''} need your signature
          </Text>
        </Pressable>
      )}

      {/* Nursery + latest newsfeed */}
      <View className="rounded-2xl bg-surface p-4">
        <Text className="text-sm font-medium text-gray-900">{nursery?.name ?? 'Your nursery'}</Text>
        {latestEvent ? (
          <View className="mt-2">
            <Text className="font-semibold text-gray-900">{latestEvent.title}</Text>
            {!!latestEvent.description && (
              <Text className="mt-1 text-sm text-muted">{latestEvent.description}</Text>
            )}
            <Text className="mt-1 text-xs text-muted">{fmtDate(latestEvent.date)}</Text>
          </View>
        ) : (
          <Text className="mt-2 text-sm text-muted">No recent announcements.</Text>
        )}
      </View>

      <View className="flex-row gap-3">
        <Pressable
          onPress={() => router.push('/(tabs)/bookings')}
          className="flex-1 items-center rounded-2xl bg-surface p-4"
        >
          <Text className="font-medium text-primary">Bookings</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(tabs)/invoices')}
          className="flex-1 items-center rounded-2xl bg-surface p-4"
        >
          <Text className="font-medium text-primary">Invoices</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
