import { useState, type ReactNode } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/api';
import { useStore } from '../../src/store';
import { fmtDate } from '../../src/date';
import { Card, SectionTitle, Pill, EmptyState, Loading } from '../../src/ui';
import { colors } from '../../src/theme';

interface ChildSession {
  id: number;
  day: string;
  session_type: string;
  start_time: string | null;
  end_time: string | null;
  room: string;
  end_date: string | null;
}
interface BookingRequest {
  id: number;
  day: string;
  session_type: string;
  week_start: string | null;
  status: string;
}
interface HolidayRequest {
  id: number;
  start_date: string;
  end_date: string;
  status: string;
}

const STATUS_PILL: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#cffafe', fg: '#0e7490' },
  approved: { bg: '#d1fae5', fg: colors.success },
  declined: { bg: '#fee2e2', fg: colors.danger },
};
const pillFor = (status: string) =>
  STATUS_PILL[status] ?? { bg: '#f1f5f9', fg: colors.muted };

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export default function Bookings() {
  const activeChildId = useStore((s) => s.activeChildId);
  const qc = useQueryClient();
  const [tab, setTab] = useState<'sessions' | 'requests'>('sessions');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [holidayOpen, setHolidayOpen] = useState(false);

  const sessions = useQuery({
    queryKey: ['child-sessions', activeChildId],
    queryFn: () => api.get<ChildSession[]>(`/parent/child-sessions?childId=${activeChildId}`),
    enabled: !!activeChildId,
  });

  // Submitted requests (pending + decided).
  const bookingRequests = useQuery({
    queryKey: ['booking-requests', activeChildId],
    queryFn: () => api.get<BookingRequest[]>('/parent/booking-requests'),
    enabled: !!activeChildId && tab === 'requests',
  });
  const holidayRequests = useQuery({
    queryKey: ['holiday-requests', activeChildId],
    queryFn: () => api.get<HolidayRequest[]>('/parent/holiday-requests'),
    enabled: !!activeChildId && tab === 'requests',
  });

  const requestBooking = useMutation({
    mutationFn: (b: { day: string; sessionType: string; weekStart: string; parentNote: string }) =>
      api.post('/parent/booking-requests', { childId: activeChildId, ...b }),
    onSuccess: () => {
      setBookingOpen(false);
      qc.invalidateQueries({ queryKey: ['booking-requests', activeChildId] });
      Alert.alert('Request sent', 'The nursery will review your booking request.');
    },
    onError: (e: any) => Alert.alert('Could not send', e?.message ?? 'Try again.'),
  });

  const requestHoliday = useMutation({
    mutationFn: (b: { startDate: string; endDate: string; reason: string }) =>
      api.post('/parent/holiday-requests', { childId: activeChildId, ...b }),
    onSuccess: () => {
      setHolidayOpen(false);
      qc.invalidateQueries({ queryKey: ['holiday-requests', activeChildId] });
      Alert.alert('Request sent', 'The nursery will review your holiday request.');
    },
    onError: (e: any) => Alert.alert('Could not send', e?.message ?? 'Try again.'),
  });

  return (
    <View className="flex-1 bg-bg">
      {/* Segmented tabs */}
      <View className="flex-row gap-2 bg-surface px-4 py-3">
        {(['sessions', 'requests'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            className={`flex-1 items-center rounded-xl py-2.5 ${
              tab === t ? 'bg-primary' : 'bg-bg'
            }`}
          >
            <Text className={`font-semibold capitalize ${tab === t ? 'text-white' : 'text-muted'}`}>
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'sessions' ? (
        sessions.isLoading ? (
          <Loading />
        ) : (
          <ScrollView
            contentContainerClassName="p-4 gap-3"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={sessions.isFetching}
                onRefresh={() => sessions.refetch()}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          >
            <SectionTitle>Weekly schedule</SectionTitle>
            {DAYS.map((day) => {
              const items = (sessions.data ?? []).filter(
                (s) => s.day === day && (!s.end_date || s.end_date >= new Date().toISOString().slice(0, 10)),
              );
              return (
                <Card key={day} className="flex-row gap-3">
                  <View className="w-12 items-center justify-center rounded-xl bg-primary-light py-2">
                    <Text className="text-sm font-bold text-primary">{day}</Text>
                  </View>
                  <View className="flex-1 justify-center">
                    {items.length === 0 ? (
                      <Text className="text-sm text-muted">No session</Text>
                    ) : (
                      items.map((s) => (
                        <View key={s.id}>
                          <Text className="text-sm font-semibold text-gray-900">{s.session_type}</Text>
                          {(s.start_time || s.room) && (
                            <Text className="mt-0.5 text-xs text-muted">
                              {s.start_time ? `${s.start_time}–${s.end_time ?? ''}` : ''}
                              {s.start_time && s.room ? ' · ' : ''}
                              {s.room ?? ''}
                            </Text>
                          )}
                        </View>
                      ))
                    )}
                  </View>
                </Card>
              );
            })}
          </ScrollView>
        )
      ) : (
        <ScrollView
          contentContainerClassName="p-4 gap-3"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={bookingRequests.isFetching || holidayRequests.isFetching}
              onRefresh={() => {
                bookingRequests.refetch();
                holidayRequests.refetch();
              }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Action buttons */}
          <Pressable onPress={() => setBookingOpen(true)}>
            <Card className="flex-row items-center gap-3">
              <Text className="text-2xl">📅</Text>
              <View className="flex-1">
                <Text className="font-semibold text-gray-900">Request a session change</Text>
                <Text className="text-xs text-muted">Add or swap a nursery day</Text>
              </View>
              <Text className="text-muted">›</Text>
            </Card>
          </Pressable>
          <Pressable onPress={() => setHolidayOpen(true)}>
            <Card className="flex-row items-center gap-3">
              <Text className="text-2xl">🏖️</Text>
              <View className="flex-1">
                <Text className="font-semibold text-gray-900">Request holiday credit</Text>
                <Text className="text-xs text-muted">Let us know about time away</Text>
              </View>
              <Text className="text-muted">›</Text>
            </Card>
          </Pressable>

          {/* Session requests */}
          <View className="mt-2 gap-2">
            <SectionTitle>Session requests</SectionTitle>
            {(bookingRequests.data ?? []).length === 0 ? (
              <EmptyState emoji="📅" title="No session requests" subtitle="Requests you submit will appear here." />
            ) : (
              bookingRequests.data!.map((r) => {
                const pill = pillFor(r.status);
                return (
                  <Card key={r.id} className="flex-row items-center justify-between gap-3">
                    <Text className="flex-1 text-sm text-gray-900">
                      {r.day} · {r.session_type}
                      {r.week_start ? ` · w/c ${fmtDate(r.week_start)}` : ''}
                    </Text>
                    <Pill label={r.status} bg={pill.bg} fg={pill.fg} />
                  </Card>
                );
              })
            )}
          </View>

          {/* Holiday requests */}
          <View className="mt-2 gap-2">
            <SectionTitle>Holiday requests</SectionTitle>
            {(holidayRequests.data ?? []).length === 0 ? (
              <EmptyState emoji="🏖️" title="No holiday requests" subtitle="Requests you submit will appear here." />
            ) : (
              holidayRequests.data!.map((r) => {
                const pill = pillFor(r.status);
                return (
                  <Card key={r.id} className="flex-row items-center justify-between gap-3">
                    <Text className="flex-1 text-sm text-gray-900">
                      {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                    </Text>
                    <Pill label={r.status} bg={pill.bg} fg={pill.fg} />
                  </Card>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      <BookingRequestModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        submitting={requestBooking.isPending}
        onSubmit={(b) => requestBooking.mutate(b)}
      />
      <HolidayRequestModal
        open={holidayOpen}
        onClose={() => setHolidayOpen(false)}
        submitting={requestHoliday.isPending}
        onSubmit={(b) => requestHoliday.mutate(b)}
      />
    </View>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-sm font-semibold text-gray-900">{label}</Text>
      {children}
    </View>
  );
}

function BookingRequestModal({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (b: { day: string; sessionType: string; weekStart: string; parentNote: string }) => void;
  submitting: boolean;
}) {
  const [day, setDay] = useState('Mon');
  const [sessionType, setSessionType] = useState('Full Day');
  const [weekStart, setWeekStart] = useState('');
  const [parentNote, setParentNote] = useState('');
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <ScrollView className="flex-1 bg-bg" contentContainerClassName="p-4">
        <Text className="mb-5 text-xl font-bold text-gray-900">Request a session change</Text>
        <Labeled label="Day">
          <View className="flex-row flex-wrap gap-2">
            {DAYS.map((d) => (
              <Pressable
                key={d}
                onPress={() => setDay(d)}
                className={`rounded-full px-4 py-2 ${d === day ? 'bg-primary' : 'border border-border bg-surface'}`}
              >
                <Text className={`font-semibold ${d === day ? 'text-white' : 'text-gray-700'}`}>{d}</Text>
              </Pressable>
            ))}
          </View>
        </Labeled>
        <Labeled label="Session type">
          <TextInput
            value={sessionType}
            onChangeText={setSessionType}
            placeholderTextColor={colors.muted}
            className="rounded-xl border border-border bg-bg px-4 py-3 text-gray-900"
          />
        </Labeled>
        <Labeled label="Week starting (YYYY-MM-DD)">
          <TextInput
            value={weekStart}
            onChangeText={setWeekStart}
            placeholder="2026-06-22"
            placeholderTextColor={colors.muted}
            className="rounded-xl border border-border bg-bg px-4 py-3 text-gray-900"
          />
        </Labeled>
        <Labeled label="Note (optional)">
          <TextInput
            value={parentNote}
            onChangeText={setParentNote}
            multiline
            placeholderTextColor={colors.muted}
            className="h-24 rounded-xl border border-border bg-bg px-4 py-3 text-gray-900"
          />
        </Labeled>
        <Pressable
          onPress={() => onSubmit({ day, sessionType, weekStart, parentNote })}
          disabled={submitting || !weekStart}
          className="items-center rounded-xl bg-primary py-3 disabled:opacity-50"
        >
          <Text className="font-semibold text-white">{submitting ? 'Sending…' : 'Send request'}</Text>
        </Pressable>
        <Pressable onPress={onClose} className="mt-3 items-center rounded-xl border border-border bg-surface py-3">
          <Text className="font-semibold text-primary">Cancel</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}

function HolidayRequestModal({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (b: { startDate: string; endDate: string; reason: string }) => void;
  submitting: boolean;
}) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <ScrollView className="flex-1 bg-bg" contentContainerClassName="p-4">
        <Text className="mb-5 text-xl font-bold text-gray-900">Request holiday credit</Text>
        <Labeled label="Start date (YYYY-MM-DD)">
          <TextInput
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2026-07-01"
            placeholderTextColor={colors.muted}
            className="rounded-xl border border-border bg-bg px-4 py-3 text-gray-900"
          />
        </Labeled>
        <Labeled label="End date (YYYY-MM-DD)">
          <TextInput
            value={endDate}
            onChangeText={setEndDate}
            placeholder="2026-07-07"
            placeholderTextColor={colors.muted}
            className="rounded-xl border border-border bg-bg px-4 py-3 text-gray-900"
          />
        </Labeled>
        <Labeled label="Reason (optional)">
          <TextInput
            value={reason}
            onChangeText={setReason}
            multiline
            placeholderTextColor={colors.muted}
            className="h-24 rounded-xl border border-border bg-bg px-4 py-3 text-gray-900"
          />
        </Labeled>
        <Pressable
          onPress={() => onSubmit({ startDate, endDate, reason })}
          disabled={submitting || !startDate || !endDate}
          className="items-center rounded-xl bg-primary py-3 disabled:opacity-50"
        >
          <Text className="font-semibold text-white">{submitting ? 'Sending…' : 'Send request'}</Text>
        </Pressable>
        <Pressable onPress={onClose} className="mt-3 items-center rounded-xl border border-border bg-surface py-3">
          <Text className="font-semibold text-primary">Cancel</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}
