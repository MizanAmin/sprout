import { useState } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/api';
import { useStore } from '../../src/store';

interface Log {
  id: number;
  type: 'meal' | 'sleep' | 'nappy' | 'mood' | 'activity' | 'note';
  details: string;
  time: string | null;
}
interface ReportCard {
  dailyLogs: Log[];
  mood: string | null;
  mealsCount: number;
  napsCount: number;
  nappiesCount: number;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const shiftDay = (dateStr: string, days: number) => {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
};

const SECTIONS: { title: string; types: Log['type'][] }[] = [
  { title: 'Meals', types: ['meal'] },
  { title: 'Naps', types: ['sleep'] },
  { title: 'Nappies', types: ['nappy'] },
  { title: 'Mood', types: ['mood'] },
  { title: 'Activities & Notes', types: ['activity', 'note'] },
];

export default function Daily() {
  const activeChildId = useStore((s) => s.activeChildId);
  const [date, setDate] = useState(iso(new Date()));

  const report = useQuery({
    queryKey: ['report-card', activeChildId, date],
    queryFn: () => api.get<ReportCard>(`/parent/report-card?childId=${activeChildId}&date=${date}`),
    enabled: !!activeChildId,
  });

  const logs = report.data?.dailyLogs ?? [];

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="p-4 gap-4">
      {/* Date header */}
      <View className="flex-row items-center justify-between rounded-2xl bg-surface px-4 py-3">
        <Pressable onPress={() => setDate((d) => shiftDay(d, -1))}>
          <Text className="text-lg text-primary">‹</Text>
        </Pressable>
        <Text className="font-semibold text-gray-900">{date}</Text>
        <Pressable onPress={() => setDate((d) => shiftDay(d, 1))} disabled={date >= iso(new Date())}>
          <Text className={`text-lg ${date >= iso(new Date()) ? 'text-gray-300' : 'text-primary'}`}>›</Text>
        </Pressable>
      </View>

      {/* Summary bar */}
      <View className="flex-row justify-around rounded-2xl bg-surface px-4 py-3">
        <Text className="text-sm text-gray-700">🍽 {report.data?.mealsCount ?? 0}</Text>
        <Text className="text-sm text-gray-700">💤 {report.data?.napsCount ?? 0}</Text>
        <Text className="text-sm text-gray-700">🧷 {report.data?.nappiesCount ?? 0}</Text>
        <Text className="text-sm text-gray-700">😊 {report.data?.mood ?? '—'}</Text>
      </View>

      {report.isLoading ? (
        <ActivityIndicator className="mt-8" />
      ) : logs.length === 0 ? (
        <View className="rounded-2xl border border-dashed border-border p-8">
          <Text className="text-center text-muted">No logs for this day.</Text>
        </View>
      ) : (
        SECTIONS.map((section) => {
          const items = logs.filter((l) => section.types.includes(l.type));
          if (items.length === 0) return null;
          return (
            <View key={section.title} className="rounded-2xl bg-surface p-4">
              <Text className="mb-2 font-semibold text-gray-900">{section.title}</Text>
              {items.map((l) => (
                <View key={l.id} className="flex-row justify-between border-t border-border py-2 first:border-t-0">
                  <Text className="flex-1 text-sm text-gray-700">{l.details || '—'}</Text>
                  {!!l.time && <Text className="ml-2 text-xs text-muted">{l.time}</Text>}
                </View>
              ))}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
