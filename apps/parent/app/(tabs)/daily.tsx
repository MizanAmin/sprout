import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/api';
import { useStore } from '../../src/store';
import { fmtDate } from '../../src/date';
import { moodDisplay, logDisplay } from '../../src/humanize';
import { ScreenScroll, Card, SectionTitle, EmptyState, Loading } from '../../src/ui';

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
const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : '');

export default function Daily() {
  const activeChildId = useStore((s) => s.activeChildId);
  const [date, setDate] = useState(iso(new Date()));
  const isToday = date >= iso(new Date());

  const report = useQuery({
    queryKey: ['report-card', activeChildId, date],
    queryFn: () => api.get<ReportCard>(`/parent/report-card?childId=${activeChildId}&date=${date}`),
    enabled: !!activeChildId,
  });

  const logs = report.data?.dailyLogs ?? [];
  const mood = moodDisplay(report.data?.mood);

  return (
    <ScreenScroll refreshing={report.isFetching} onRefresh={() => report.refetch()}>
      {/* Date navigator */}
      <Card className="flex-row items-center justify-between">
        <Pressable onPress={() => setDate((d) => shiftDay(d, -1))} className="px-3 py-1">
          <Text className="text-2xl text-primary">‹</Text>
        </Pressable>
        <View className="items-center">
          <Text className="text-base font-semibold text-gray-900">{fmtDate(date)}</Text>
          {isToday && <Text className="text-xs text-muted">Today</Text>}
        </View>
        <Pressable
          onPress={() => !isToday && setDate((d) => shiftDay(d, 1))}
          disabled={isToday}
          className="px-3 py-1"
        >
          <Text className={`text-2xl ${isToday ? 'text-gray-300' : 'text-primary'}`}>›</Text>
        </Pressable>
      </Card>

      {/* Mood banner */}
      {mood && (
        <Card className="flex-row items-center gap-3" >
          <View
            className="h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: mood.bg }}
          >
            <Text className="text-3xl">{mood.emoji}</Text>
          </View>
          <View>
            <Text className="text-xs font-bold uppercase tracking-wide text-muted">
              Today&apos;s mood
            </Text>
            <Text className="text-lg font-extrabold" style={{ color: mood.fg }}>
              {mood.label}
            </Text>
          </View>
        </Card>
      )}

      {/* Summary tiles */}
      <View className="flex-row gap-2">
        {[
          { emoji: '🍽️', val: report.data?.mealsCount ?? 0, label: 'Meals', bg: '#dcfce7', fg: '#166534' },
          { emoji: '😴', val: report.data?.napsCount ?? 0, label: 'Naps', bg: '#ede9fe', fg: '#4c1d95' },
          { emoji: '🧷', val: report.data?.nappiesCount ?? 0, label: 'Nappies', bg: '#fef3c7', fg: '#92400e' },
        ].map((s) => (
          <View key={s.label} className="flex-1 items-center rounded-2xl py-3" style={{ backgroundColor: s.bg }}>
            <Text className="text-xl">{s.emoji}</Text>
            <Text className="text-lg font-extrabold" style={{ color: s.fg }}>{s.val}</Text>
            <Text className="text-[11px] font-semibold" style={{ color: s.fg }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Timeline */}
      <SectionTitle>Timeline</SectionTitle>
      {report.isLoading ? (
        <Loading />
      ) : logs.length === 0 ? (
        <EmptyState emoji="🗓️" title="No logs for this day" subtitle="Check back later or pick another day." />
      ) : (
        <View className="gap-2">
          {logs.map((l) => {
            const d = logDisplay(l.type);
            return (
              <Card key={l.id} className="flex-row items-start gap-3">
                <View
                  className="h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: d.bg }}
                >
                  <Text className="text-lg">{d.emoji}</Text>
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-semibold" style={{ color: d.fg }}>{d.label}</Text>
                    {!!fmtTime(l.time) && <Text className="text-xs text-muted">{fmtTime(l.time)}</Text>}
                  </View>
                  {!!l.details && <Text className="mt-0.5 text-sm text-gray-900">{l.details}</Text>}
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </ScreenScroll>
  );
}
