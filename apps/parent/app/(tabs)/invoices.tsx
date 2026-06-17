import { useState } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/api';
import { useStore } from '../../src/store';

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

const STATUS_COLORS: Record<Invoice['status'], string> = {
  Paid: 'bg-success-light text-success',
  Pending: 'bg-warning-light text-warning',
  Overdue: 'bg-danger-light text-danger',
  Cancelled: 'bg-gray-100 text-muted',
};

function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((v) => !v)} className="rounded-2xl bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="font-semibold text-gray-900">{invoice.period || invoice.invoice_ref}</Text>
          <Text className="text-xs text-muted">
            {invoice.invoice_ref}
            {invoice.due_date ? ` · due ${invoice.due_date}` : ''}
          </Text>
        </View>
        <View className="items-end">
          <Text className="font-semibold text-gray-900">{gbp(invoice.amount)}</Text>
          <View className={`mt-1 rounded-full px-2 py-0.5 ${STATUS_COLORS[invoice.status]}`}>
            <Text className="text-xs font-medium">{invoice.status}</Text>
          </View>
        </View>
      </View>
      {open && (
        <View className="mt-3 border-t border-border pt-3">
          {invoice.line_items?.map((li, i) => (
            <View key={i} className="flex-row justify-between py-1">
              <Text className="flex-1 text-sm text-gray-700">{li.description}</Text>
              <Text className="text-sm text-gray-700">{gbp(li.amount)}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

export default function Invoices() {
  const activeChildId = useStore((s) => s.activeChildId);
  const { data, isLoading } = useQuery({
    queryKey: ['invoices', activeChildId],
    queryFn: () => api.get<Invoice[]>('/parent/invoices'),
    enabled: !!activeChildId,
  });

  if (isLoading) return <ActivityIndicator className="mt-8" />;

  const outstanding = (data ?? []).filter((i) => i.status !== 'Paid' && i.status !== 'Cancelled');
  const paid = (data ?? []).filter((i) => i.status === 'Paid');

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="p-4 gap-4">
      <Text className="text-lg font-semibold text-gray-900">Outstanding</Text>
      {outstanding.length === 0 ? (
        <Text className="text-sm text-muted">Nothing outstanding 🎉</Text>
      ) : (
        outstanding.map((inv) => <InvoiceCard key={inv.id} invoice={inv} />)
      )}

      <Text className="mt-2 text-lg font-semibold text-gray-900">Paid</Text>
      {paid.length === 0 ? (
        <Text className="text-sm text-muted">No paid invoices yet.</Text>
      ) : (
        paid.map((inv) => <InvoiceCard key={inv.id} invoice={inv} />)
      )}
    </ScrollView>
  );
}
