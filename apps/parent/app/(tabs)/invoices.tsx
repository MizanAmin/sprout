import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/api';
import { useStore } from '../../src/store';
import { fmtDate } from '../../src/date';
import { ScreenScroll, Card, SectionTitle, Pill, EmptyState, Loading } from '../../src/ui';
import { colors } from '../../src/theme';

interface LineItem {
  description: string;
  hours?: number;
  rate?: number;
  amount: number;
}
interface Invoice {
  id: number;
  invoice_ref: string;
  period: string;
  amount: number;
  amount_paid: number;
  status: 'Pending' | 'Paid' | 'Overdue' | 'Cancelled';
  due_date: string | null;
  line_items: LineItem[];
}

const gbp = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(n));

const STATUS_PILL: Record<Invoice['status'], { bg: string; fg: string }> = {
  Paid: { bg: '#d1fae5', fg: colors.success },
  Pending: { bg: '#cffafe', fg: '#0e7490' },
  Overdue: { bg: '#fee2e2', fg: colors.danger },
  Cancelled: { bg: '#f1f5f9', fg: colors.muted },
};

function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const [open, setOpen] = useState(false);
  const pill = STATUS_PILL[invoice.status];
  return (
    <Pressable onPress={() => setOpen((v) => !v)}>
      <Card>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="font-semibold text-gray-900">
              {invoice.period || invoice.invoice_ref}
            </Text>
            <Text className="mt-0.5 text-xs text-muted">
              {invoice.invoice_ref}
              {invoice.due_date ? ` · due ${fmtDate(invoice.due_date)}` : ''}
            </Text>
          </View>
          <View className="items-end gap-1">
            <Text className="text-base font-bold text-gray-900">{gbp(invoice.amount)}</Text>
            <Pill label={invoice.status} bg={pill.bg} fg={pill.fg} />
          </View>
        </View>
        {open && (
          <View className="mt-3 gap-1 border-t border-border pt-3">
            {invoice.line_items?.map((li, i) => (
              <View key={i} className="flex-row justify-between gap-3 py-1">
                <Text className="flex-1 text-sm text-muted">{li.description}</Text>
                <Text className="text-sm font-medium text-gray-900">{gbp(li.amount)}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </Pressable>
  );
}

export default function Invoices() {
  const activeChildId = useStore((s) => s.activeChildId);
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['invoices', activeChildId],
    queryFn: () => api.get<Invoice[]>('/parent/invoices'),
    enabled: !!activeChildId,
  });

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg">
        <Loading />
      </View>
    );
  }

  const outstanding = (data ?? []).filter((i) => i.status !== 'Paid' && i.status !== 'Cancelled');
  const paid = (data ?? []).filter((i) => i.status === 'Paid');
  const totalDue = outstanding.reduce((sum, i) => sum + (Number(i.amount) - Number(i.amount_paid)), 0);

  return (
    <ScreenScroll refreshing={isFetching} onRefresh={refetch}>
      {/* Balance summary */}
      <Card className="flex-row items-center gap-3">
        <Text className="text-3xl">💷</Text>
        <View className="flex-1">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted">Total due</Text>
          <Text className="text-2xl font-extrabold text-gray-900">{gbp(totalDue)}</Text>
        </View>
        {outstanding.length === 0 ? (
          <Pill label="All clear" bg="#d1fae5" fg={colors.success} />
        ) : (
          <Pill
            label={`${outstanding.length} outstanding`}
            bg="#fef3c7"
            fg={colors.warning}
          />
        )}
      </Card>

      {/* Outstanding */}
      <View className="gap-2">
        <SectionTitle>Outstanding</SectionTitle>
        {outstanding.length === 0 ? (
          <EmptyState
            emoji="🎉"
            title="Nothing outstanding"
            subtitle="You're all paid up — thank you!"
          />
        ) : (
          <View className="gap-3">
            {outstanding.map((inv) => (
              <InvoiceCard key={inv.id} invoice={inv} />
            ))}
          </View>
        )}
      </View>

      {/* Paid */}
      <View className="gap-2">
        <SectionTitle>Paid</SectionTitle>
        {paid.length === 0 ? (
          <EmptyState emoji="💷" title="No paid invoices yet" />
        ) : (
          <View className="gap-3">
            {paid.map((inv) => (
              <InvoiceCard key={inv.id} invoice={inv} />
            ))}
          </View>
        )}
      </View>
    </ScreenScroll>
  );
}
