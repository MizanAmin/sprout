import { useState, type ReactNode } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/api';
import { useStore } from '../../src/store';

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

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-warning-light text-warning',
  approved: 'bg-success-light text-success',
  declined: 'bg-danger-light text-danger',
};

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
      <View className="flex-row gap-1 border-b border-border bg-surface px-4">
        {(['sessions', 'requests'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} className="px-3 py-3">
            <Text
              className={
                tab === t ? 'font-medium capitalize text-primary' : 'capitalize text-muted'
              }
            >
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'sessions' ? (
        sessions.isLoading ? (
          <ActivityIndicator className="mt-8" />
        ) : (
          <ScrollView contentContainerClassName="p-4 gap-3">
            {DAYS.map((day) => {
              const items = (sessions.data ?? []).filter(
                (s) => s.day === day && (!s.end_date || s.end_date >= new Date().toISOString().slice(0, 10)),
              );
              return (
                <View key={day} className="rounded-2xl bg-surface p-4">
                  <Text className="mb-1 font-semibold text-gray-900">{day}</Text>
                  {items.length === 0 ? (
                    <Text className="text-sm text-muted">No session</Text>
                  ) : (
                    items.map((s) => (
                      <Text key={s.id} className="text-sm text-gray-700">
                        {s.session_type}
                        {s.start_time ? ` · ${s.start_time}–${s.end_time ?? ''}` : ''}
                        {s.room ? ` · ${s.room}` : ''}
                      </Text>
                    ))
                  )}
                </View>
              );
            })}
          </ScrollView>
        )
      ) : (
        <ScrollView contentContainerClassName="p-4 gap-3">
          <Pressable onPress={() => setBookingOpen(true)} className="rounded-2xl bg-surface p-4">
            <Text className="font-medium text-primary">Request a session change</Text>
          </Pressable>
          <Pressable onPress={() => setHolidayOpen(true)} className="rounded-2xl bg-surface p-4">
            <Text className="font-medium text-primary">Request holiday credit</Text>
          </Pressable>

          <Text className="mt-2 px-1 text-sm font-semibold text-gray-900">Session requests</Text>
          {(bookingRequests.data ?? []).length === 0 ? (
            <Text className="px-1 text-xs text-muted">None submitted.</Text>
          ) : (
            bookingRequests.data!.map((r) => (
              <View key={r.id} className="flex-row items-center justify-between rounded-2xl bg-surface p-4">
                <Text className="text-sm text-gray-700">
                  {r.day} · {r.session_type}
                  {r.week_start ? ` · w/c ${r.week_start}` : ''}
                </Text>
                <View className={`rounded-full px-2 py-0.5 ${STATUS_STYLE[r.status] ?? 'bg-gray-100 text-muted'}`}>
                  <Text className="text-xs font-medium capitalize">{r.status}</Text>
                </View>
              </View>
            ))
          )}

          <Text className="mt-2 px-1 text-sm font-semibold text-gray-900">Holiday requests</Text>
          {(holidayRequests.data ?? []).length === 0 ? (
            <Text className="px-1 text-xs text-muted">None submitted.</Text>
          ) : (
            holidayRequests.data!.map((r) => (
              <View key={r.id} className="flex-row items-center justify-between rounded-2xl bg-surface p-4">
                <Text className="text-sm text-gray-700">
                  {r.start_date} → {r.end_date}
                </Text>
                <View className={`rounded-full px-2 py-0.5 ${STATUS_STYLE[r.status] ?? 'bg-gray-100 text-muted'}`}>
                  <Text className="text-xs font-medium capitalize">{r.status}</Text>
                </View>
              </View>
            ))
          )}
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
    <View className="mb-3">
      <Text className="mb-1 text-sm font-medium text-gray-700">{label}</Text>
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
        <Text className="mb-4 text-lg font-semibold text-gray-900">Request a session change</Text>
        <Labeled label="Day">
          <View className="flex-row flex-wrap gap-2">
            {DAYS.map((d) => (
              <Pressable
                key={d}
                onPress={() => setDay(d)}
                className={`rounded-full px-3 py-1 ${d === day ? 'bg-primary' : 'bg-gray-100'}`}
              >
                <Text className={d === day ? 'text-white' : 'text-gray-700'}>{d}</Text>
              </Pressable>
            ))}
          </View>
        </Labeled>
        <Labeled label="Session type">
          <TextInput value={sessionType} onChangeText={setSessionType} className="rounded-lg border border-border bg-surface px-3 py-2" />
        </Labeled>
        <Labeled label="Week starting (YYYY-MM-DD)">
          <TextInput value={weekStart} onChangeText={setWeekStart} placeholder="2026-06-22" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </Labeled>
        <Labeled label="Note (optional)">
          <TextInput value={parentNote} onChangeText={setParentNote} multiline className="h-20 rounded-lg border border-border bg-surface px-3 py-2" />
        </Labeled>
        <Pressable
          onPress={() => onSubmit({ day, sessionType, weekStart, parentNote })}
          disabled={submitting || !weekStart}
          className="items-center rounded-lg bg-primary px-4 py-3 disabled:opacity-50"
        >
          <Text className="font-medium text-white">{submitting ? 'Sending…' : 'Send request'}</Text>
        </Pressable>
        <Pressable onPress={onClose} className="mt-3 items-center">
          <Text className="text-primary">Cancel</Text>
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
        <Text className="mb-4 text-lg font-semibold text-gray-900">Request holiday credit</Text>
        <Labeled label="Start date (YYYY-MM-DD)">
          <TextInput value={startDate} onChangeText={setStartDate} placeholder="2026-07-01" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </Labeled>
        <Labeled label="End date (YYYY-MM-DD)">
          <TextInput value={endDate} onChangeText={setEndDate} placeholder="2026-07-07" className="rounded-lg border border-border bg-surface px-3 py-2" />
        </Labeled>
        <Labeled label="Reason (optional)">
          <TextInput value={reason} onChangeText={setReason} multiline className="h-20 rounded-lg border border-border bg-surface px-3 py-2" />
        </Labeled>
        <Pressable
          onPress={() => onSubmit({ startDate, endDate, reason })}
          disabled={submitting || !startDate || !endDate}
          className="items-center rounded-lg bg-primary px-4 py-3 disabled:opacity-50"
        >
          <Text className="font-medium text-white">{submitting ? 'Sending…' : 'Send request'}</Text>
        </Pressable>
        <Pressable onPress={onClose} className="mt-3 items-center">
          <Text className="text-primary">Cancel</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}
