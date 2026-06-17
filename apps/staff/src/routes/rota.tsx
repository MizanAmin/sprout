import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useRota,
  useUpsertRota,
  useDeleteRota,
  mondayOf,
  addWeeks,
  type RotaRow,
} from '../features/rota/useRota';
import { Spinner, EmptyState, Field } from '../components/ui';

export const Route = createFileRoute('/rota')({
  component: RotaPage,
});

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;
const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
};

const rotaFormSchema = z.object({
  staffName: z.string().min(1, 'Staff name is required'),
  weekStart: z.string().min(1, 'Week is required'),
  mon: z.string().optional(),
  tue: z.string().optional(),
  wed: z.string().optional(),
  thu: z.string().optional(),
  fri: z.string().optional(),
});
type RotaFormInput = z.infer<typeof rotaFormSchema>;

function RotaPage() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const { data: rows, isLoading } = useRota(weekStart);
  const upsertRota = useUpsertRota();
  const deleteRota = useDeleteRota();

  const [editing, setEditing] = useState<RotaRow | null>(null);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Rota</h1>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => setWeekStart((w) => addWeeks(w, -1))}
          >
            ← Prev
          </button>
          <input
            type="date"
            className="input max-w-[10rem]"
            value={weekStart}
            onChange={(e) => setWeekStart(mondayOf(new Date(e.target.value)))}
          />
          <button
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => setWeekStart((w) => addWeeks(w, 1))}
          >
            Next →
          </button>
        </div>
      </div>

      <p className="text-sm text-muted">Week beginning Monday {weekStart}</p>

      {isLoading ? (
        <Spinner />
      ) : (rows ?? []).length === 0 ? (
        <EmptyState title="No rota for this week" description="Add a staff member below." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Staff</th>
                {DAYS.map((d) => (
                  <th key={d} className="px-4 py-2 font-medium">
                    {DAY_LABELS[d]}
                  </th>
                ))}
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(rows ?? []).map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{r.staff_name}</td>
                  {DAYS.map((d) => (
                    <td key={d} className="px-4 py-2">
                      {r[d] || '—'}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right">
                    <button className="text-sm text-primary" onClick={() => setEditing(r)}>
                      Edit
                    </button>
                    <button
                      className="ml-3 text-sm text-danger"
                      onClick={() => {
                        if (confirm(`Delete rota for ${r.staff_name}?`)) deleteRota.mutate(r.id);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RotaForm
        key={editing?.id ?? 'new'}
        editing={editing}
        weekStart={weekStart}
        submitting={upsertRota.isPending}
        onSubmit={(data) =>
          upsertRota.mutate(
            { ...data, weekStart },
            { onSuccess: () => setEditing(null) },
          )
        }
        onCancel={() => setEditing(null)}
      />
    </div>
  );
}

function RotaForm({
  editing,
  weekStart,
  submitting,
  onSubmit,
  onCancel,
}: {
  editing: RotaRow | null;
  weekStart: string;
  submitting: boolean;
  onSubmit: (data: RotaFormInput) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RotaFormInput>({
    resolver: zodResolver(rotaFormSchema),
    defaultValues: {
      staffName: editing?.staff_name ?? '',
      weekStart,
      mon: editing?.mon ?? '',
      tue: editing?.tue ?? '',
      wed: editing?.wed ?? '',
      thu: editing?.thu ?? '',
      fri: editing?.fri ?? '',
    },
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-xl border border-border bg-surface p-4"
    >
      <div className="text-sm font-medium text-gray-700">
        {editing ? `Edit ${editing.staff_name}` : 'Add staff member'}
      </div>
      <div className="grid grid-cols-6 gap-3">
        <Field label="Staff name" error={errors.staffName?.message}>
          <input {...register('staffName')} className="input" />
        </Field>
        {DAYS.map((d) => (
          <Field key={d} label={DAY_LABELS[d]}>
            <input {...register(d)} className="input" placeholder="e.g. 8–4" />
          </Field>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        {editing && (
          <button
            type="button"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : editing ? 'Save' : 'Add'}
        </button>
      </div>
    </form>
  );
}
